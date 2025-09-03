import {Router} from 'express';
import {v4 as uuidv4} from 'uuid';
import {pool, pubsub, io} from '../server';

const router = Router();

// Submit traffic detection
router.post('/', async (req: any, res: any) => {
  try {
    // Handle both flat and nested formats
    const {
      device_id,
      deviceId,
      detection,
      location,
      latitude,
      longitude,
      confidence,
      traffic_light_color,
      heading,
      timestamp,
    } = req.body;

    const finalDeviceId = device_id || deviceId;
    const finalConfidence = confidence || detection?.confidence;
    const finalLocation = location || {lat: latitude, lng: longitude};

    console.log('Received detection data:', JSON.stringify(req.body, null, 2));
    console.log('Parsed values:', {
      finalDeviceId,
      finalConfidence,
      finalLocation,
      timestamp,
    });

    // Validate required fields
    if (!finalDeviceId) {
      return res.status(400).json({error: 'device_id is required'});
    }
    if (!finalConfidence) {
      return res.status(400).json({error: 'confidence is required'});
    }
    if (!timestamp) {
      return res.status(400).json({error: 'timestamp is required'});
    }

    let detectionId: string;

    // Let database generate UUID - don't specify ID
    try {
      const result = await pool.query(
        `INSERT INTO detections (device_id, timestamp, confidence) 
         VALUES ($1, $2, $3) RETURNING id`,
        [finalDeviceId, new Date(timestamp), finalConfidence],
      );

      detectionId = result.rows[0].id;
      console.log('Detection inserted successfully with ID:', detectionId);

      // Return success immediately after database insert
      res.status(201).json({
        detectionId,
        status: 'processed',
        message: 'Detection recorded successfully',
      });
    } catch (insertError) {
      console.error('Detection insert failed:', insertError);

      // Return the specific error
      res.status(500).json({
        error: 'Detection insert failed',
        details:
          insertError instanceof Error ? insertError.message : 'Unknown error',
        sqlState: (insertError as any)?.code || 'unknown',
        received: req.body,
      });
      return;
    }

    // Do async processing after response (no await)
    processAsyncOperations(
      finalDeviceId,
      finalLocation,
      detection || {confidence: finalConfidence, state: traffic_light_color},
      detectionId,
      timestamp,
    );
  } catch (error) {
    console.error('Detection processing failed:', error);
    res.status(500).json({
      error: 'Detection processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Async processing function
async function processAsyncOperations(
  deviceId: string,
  location: any,
  detection: any,
  detectionId: string,
  timestamp: string,
) {
  try {
    // Publish to Pub/Sub for real-time processing
    const eventData = {
      detectionId,
      deviceId,
      location,
      detection,
      timestamp,
    };

    await pubsub
      .topic('traffic-events')
      .publish(Buffer.from(JSON.stringify(eventData)));

    // Process nearby users for real-time alerts
    await processNearbyAlerts(location, detection, detectionId);

    console.log('Async processing completed for detection:', detectionId);
  } catch (error) {
    console.error('Async processing failed for detection:', detectionId, error);
  }
}

// Get detections for a device
router.get('/device/:deviceId', async (req: any, res: any) => {
  try {
    const {deviceId} = req.params;
    const {limit = 50, offset = 0} = req.query;

    const result = await pool.query(
      `
      SELECT * FROM detections 
      WHERE device_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `,
      [deviceId, limit, offset],
    );

    res.json({
      detections: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    console.error('Failed to get detections:', error);
    res.status(500).json({error: 'Failed to get detections'});
  }
});

// Confirm a detection
router.post('/:detectionId/confirm', async (req: any, res: any) => {
  try {
    const {detectionId} = req.params;
    const {confirmed, state} = req.body;

    await pool.query(
      `
      UPDATE detections 
      SET confirmed = $1, traffic_light_state = $2, cloud_processed = true
      WHERE id = $3
    `,
      [confirmed, state, detectionId],
    );

    res.json({
      success: true,
      message: 'Detection confirmed',
      detectionId,
    });
  } catch (error) {
    console.error('Detection confirmation failed:', error);
    res.status(500).json({error: 'Confirmation failed'});
  }
});

async function processNearbyAlerts(
  location: any,
  detection: any,
  detectionId: string,
) {
  try {
    // Find nearby devices within 500m that were active in last 10 minutes
    const nearbyDevices = await pool.query(
      `
      SELECT DISTINCT d.id, d.push_token, d.platform
      FROM devices d
      JOIN detections det ON det.device_id = d.id
      WHERE ST_DWithin(
        det.location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        500
      )
      AND det.created_at > NOW() - INTERVAL '10 minutes'
      AND d.push_token IS NOT NULL
    `,
      [location.lng, location.lat],
    );

    // Create alert record
    if (nearbyDevices.rows.length > 0) {
      await pool.query(
        `
        INSERT INTO alerts (detection_id, alert_type, severity, message)
        VALUES ($1, $2, $3, $4)
      `,
        [
          detectionId,
          'traffic_detection',
          detection.confidence > 0.8 ? 'high' : 'medium',
          `${detection.state || 'Traffic light'} detected nearby`,
        ],
      );
    }

    // Broadcast via WebSocket to nearby grid cells
    const grid = getLocationGrid(location);
    io.to(`grid:${grid}`).emit('traffic_alert', {
      type: 'nearby_detection',
      detection,
      location,
      severity: detection.confidence > 0.8 ? 'high' : 'medium',
      timestamp: Date.now(),
    });

    console.log(`Alert sent to ${nearbyDevices.rows.length} nearby devices`);
  } catch (error) {
    console.error('Failed to process nearby alerts:', error);
  }
}

function getLocationGrid(location: {lat: number; lng: number}): string {
  const latGrid = Math.floor(location.lat * 100) / 100;
  const lngGrid = Math.floor(location.lng * 100) / 100;
  return `${latGrid},${lngGrid}`;
}

export default router;
