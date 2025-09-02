import {Router} from 'express';
import {pool, pubsub} from '../server';

const router = Router();

// Get traffic data for an area
router.get('/area', async (req: any, res: any) => {
  try {
    const {lat, lng, radius = 1000} = req.query;

    if (!lat || !lng) {
      return res.status(400).json({error: 'Latitude and longitude required'});
    }

    const result = await pool.query(
      `
      SELECT 
        t.*,
        ST_X(t.location) as longitude,
        ST_Y(t.location) as latitude,
        COUNT(d.id) as detection_count
      FROM traffic t
      LEFT JOIN detections d ON d.id = ANY(t.detection_ids)
      WHERE ST_DWithin(
        t.location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      AND t.updated_at > NOW() - INTERVAL '15 minutes'
      GROUP BY t.id, t.location
      ORDER BY t.updated_at DESC
    `,
      [parseFloat(lng), parseFloat(lat), parseInt(radius)],
    );

    res.json({
      traffic: result.rows,
      area: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: parseInt(radius),
      },
    });
  } catch (error) {
    console.error('Failed to get traffic data:', error);
    res.status(500).json({error: 'Failed to get traffic data'});
  }
});

// Get traffic patterns for analytics
router.get('/patterns', async (req: any, res: any) => {
  try {
    const {timeframe = '24h'} = req.query;

    let interval = '1 hour';
    let groupFormat = 'YYYY-MM-DD HH24:00';

    switch (timeframe) {
      case '1h':
        interval = '1 hour';
        groupFormat = 'YYYY-MM-DD HH24:MI';
        break;
      case '24h':
        interval = '24 hours';
        groupFormat = 'YYYY-MM-DD HH24:00';
        break;
      case '7d':
        interval = '7 days';
        groupFormat = 'YYYY-MM-DD';
        break;
    }

    const result = await pool.query(
      `
      SELECT 
        TO_CHAR(d.created_at, $1) as time_bucket,
        COUNT(*) as detection_count,
        AVG(d.confidence) as avg_confidence,
        STRING_AGG(DISTINCT d.traffic_light_state, ',') as states_detected
      FROM detections d
      WHERE d.created_at > NOW() - INTERVAL $2
      GROUP BY TO_CHAR(d.created_at, $1)
      ORDER BY time_bucket DESC
    `,
      [groupFormat, interval],
    );

    res.json({
      patterns: result.rows,
      timeframe,
      interval,
    });
  } catch (error) {
    console.error('Failed to get traffic patterns:', error);
    res.status(500).json({error: 'Failed to get traffic patterns'});
  }
});

// Update traffic state for an area
router.post('/update', async (req: any, res: any) => {
  try {
    const {location, state, duration = 300, confidence, detectionId} = req.body;

    if (!location || !state) {
      return res.status(400).json({error: 'Location and state required'});
    }

    // Check if traffic already exists for this location
    const existing = await pool.query(
      `
      SELECT id FROM traffic 
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        50
      )
    `,
      [location.lng, location.lat],
    );

    let trafficId;

    if (existing.rows.length > 0) {
      // Update existing traffic
      trafficId = existing.rows[0].id;
      await pool.query(
        `
        UPDATE traffic 
        SET state = $1, confidence = $2, duration = $3, 
            detection_ids = array_append(detection_ids, $4),
            updated_at = NOW()
        WHERE id = $5
      `,
        [state, confidence, duration, detectionId, trafficId],
      );
    } else {
      // Create new traffic record
      const newTraffic = await pool.query(
        `
        INSERT INTO traffic (location, state, confidence, duration, detection_ids)
        VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $5, ARRAY[$6])
        RETURNING id
      `,
        [location.lng, location.lat, state, confidence, duration, detectionId],
      );

      trafficId = newTraffic.rows[0].id;
    }

    // Publish traffic update
    const eventData = {
      trafficId,
      location,
      state,
      confidence,
      timestamp: Date.now(),
    };

    await pubsub
      .topic('traffic-updates')
      .publish(Buffer.from(JSON.stringify(eventData)));

    res.json({
      trafficId,
      status: 'updated',
      message: 'Traffic state updated successfully',
    });
  } catch (error) {
    console.error('Traffic update failed:', error);
    res.status(500).json({error: 'Traffic update failed'});
  }
});

// Get traffic density heatmap data
router.get('/heatmap', async (req: any, res: any) => {
  try {
    const {bounds, timeframe = '1h'} = req.query;

    if (!bounds) {
      return res
        .status(400)
        .json({error: 'Bounds required (swLat,swLng,neLat,neLng)'});
    }

    const [swLat, swLng, neLat, neLng] = bounds.split(',').map(parseFloat);

    let interval = '1 hour';
    switch (timeframe) {
      case '1h':
        interval = '1 hour';
        break;
      case '24h':
        interval = '24 hours';
        break;
      case '7d':
        interval = '7 days';
        break;
    }

    const result = await pool.query(
      `
      SELECT 
        ST_X(d.location) as lng,
        ST_Y(d.location) as lat,
        COUNT(*) as intensity,
        AVG(d.confidence) as avg_confidence
      FROM detections d
      WHERE d.created_at > NOW() - INTERVAL $1
        AND ST_Within(
          d.location,
          ST_MakeEnvelope($2, $3, $4, $5, 4326)
        )
      GROUP BY ST_SnapToGrid(d.location, 0.001)
      HAVING COUNT(*) > 1
      ORDER BY intensity DESC
    `,
      [interval, swLng, swLat, neLng, neLat],
    );

    res.json({
      heatmap: result.rows,
      bounds: {swLat, swLng, neLat, neLng},
      timeframe,
    });
  } catch (error) {
    console.error('Failed to get heatmap data:', error);
    res.status(500).json({error: 'Failed to get heatmap data'});
  }
});

export default router;
