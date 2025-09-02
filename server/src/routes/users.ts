import {Router} from 'express';
import {v4 as uuidv4} from 'uuid';
import {pool} from '../server';

const router = Router();

// Register/login user
router.post('/register', async (req: any, res: any) => {
  try {
    const {email, deviceId, name, preferences = {}} = req.body;

    if (!email || !deviceId) {
      return res.status(400).json({error: 'Email and device ID required'});
    }

    const userId = uuidv4();

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows.length > 0) {
      // Update existing user
      await pool.query(
        `
        UPDATE users 
        SET device_ids = array_append(
          COALESCE(device_ids, ARRAY[]::text[]), 
          $1
        ),
        preferences = $2,
        last_active = NOW()
        WHERE email = $3
      `,
        [deviceId, JSON.stringify(preferences), email],
      );

      return res.json({
        userId: existingUser.rows[0].id,
        message: 'User updated',
        status: 'existing',
      });
    }

    // Create new user
    await pool.query(
      `
      INSERT INTO users (id, email, name, device_ids, preferences, created_at, last_active)
      VALUES ($1, $2, $3, ARRAY[$4], $5, NOW(), NOW())
    `,
      [userId, email, name, deviceId, JSON.stringify(preferences)],
    );

    res.status(201).json({
      userId,
      message: 'User created successfully',
      status: 'created',
    });
  } catch (error) {
    console.error('User registration failed:', error);
    res.status(500).json({error: 'Registration failed'});
  }
});

// Get user profile
router.get('/:userId', async (req: any, res: any) => {
  try {
    const {userId} = req.params;

    const result = await pool.query(
      `
      SELECT 
        u.*,
        COUNT(d.id) as total_detections,
        MAX(d.created_at) as last_detection
      FROM users u
      LEFT JOIN devices dev ON dev.id = ANY(u.device_ids)
      LEFT JOIN detections d ON d.device_id = dev.id
      WHERE u.id = $1
      GROUP BY u.id
    `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({error: 'User not found'});
    }

    const user = result.rows[0];

    // Remove sensitive data
    delete user.created_at;

    res.json(user);
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({error: 'Failed to get user'});
  }
});

// Update user preferences
router.put('/:userId/preferences', async (req: any, res: any) => {
  try {
    const {userId} = req.params;
    const {preferences} = req.body;

    await pool.query(
      `
      UPDATE users 
      SET preferences = $1, last_active = NOW()
      WHERE id = $2
    `,
      [JSON.stringify(preferences), userId],
    );

    res.json({
      success: true,
      message: 'Preferences updated',
      preferences,
    });
  } catch (error) {
    console.error('Failed to update preferences:', error);
    res.status(500).json({error: 'Failed to update preferences'});
  }
});

// Get user statistics
router.get('/:userId/stats', async (req: any, res: any) => {
  try {
    const {userId} = req.params;
    const {timeframe = '30d'} = req.query;

    let interval = '30 days';
    switch (timeframe) {
      case '24h':
        interval = '24 hours';
        break;
      case '7d':
        interval = '7 days';
        break;
      case '30d':
        interval = '30 days';
        break;
    }

    // Get user's devices
    const userDevices = await pool.query(
      `
      SELECT device_ids FROM users WHERE id = $1
    `,
      [userId],
    );

    if (userDevices.rows.length === 0) {
      return res.status(404).json({error: 'User not found'});
    }

    const deviceIds = userDevices.rows[0].device_ids || [];

    if (deviceIds.length === 0) {
      return res.json({
        totalDetections: 0,
        averageConfidence: 0,
        detectionsByState: {},
        dailyActivity: [],
        timeframe,
      });
    }

    // Get detection statistics
    const stats = await pool.query(
      `
      SELECT 
        COUNT(*) as total_detections,
        AVG(confidence) as avg_confidence,
        traffic_light_state,
        COUNT(*) as state_count
      FROM detections 
      WHERE device_id = ANY($1) 
        AND created_at > NOW() - INTERVAL $2
      GROUP BY traffic_light_state
    `,
      [deviceIds, interval],
    );

    // Get daily activity
    const dailyActivity = await pool.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as detections,
        AVG(confidence) as avg_confidence
      FROM detections 
      WHERE device_id = ANY($1) 
        AND created_at > NOW() - INTERVAL $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
      [deviceIds, interval],
    );

    const detectionsByState: {[key: string]: number} = {};
    let totalDetections = 0;
    let totalConfidence = 0;

    stats.rows.forEach((row: any) => {
      detectionsByState[row.traffic_light_state || 'unknown'] = parseInt(
        row.state_count,
      );
      totalDetections += parseInt(row.state_count);
      totalConfidence +=
        parseFloat(row.avg_confidence || 0) * parseInt(row.state_count);
    });

    res.json({
      totalDetections,
      averageConfidence:
        totalDetections > 0 ? totalConfidence / totalDetections : 0,
      detectionsByState,
      dailyActivity: dailyActivity.rows,
      timeframe,
    });
  } catch (error) {
    console.error('Failed to get user stats:', error);
    res.status(500).json({error: 'Failed to get user stats'});
  }
});

// Delete user account
router.delete('/:userId', async (req: any, res: any) => {
  try {
    const {userId} = req.params;

    // Soft delete - mark as deleted but keep data for analytics
    await pool.query(
      `
      UPDATE users 
      SET email = 'deleted_' || id, 
          name = 'Deleted User',
          device_ids = ARRAY[]::text[],
          preferences = '{"deleted": true}',
          last_active = NOW()
      WHERE id = $1
    `,
      [userId],
    );

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({error: 'Failed to delete user'});
  }
});

export default router;
