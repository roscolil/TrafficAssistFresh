"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabaseInline = void 0;
// Alternative database initialization endpoint
// This provides the SQL content inline to work around the missing init.sql file issue
const initializeDatabaseInline = async (req, res) => {
    // Security check - only allow in development
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Database initialization is not allowed in production',
            message: 'This endpoint is only available in development environment',
        });
    }
    try {
        const { pool } = require('../server');
        // Define the complete SQL schema inline
        const sqlStatements = [
            // Enable extensions
            `CREATE EXTENSION IF NOT EXISTS postgis;`,
            // Create enum types
            `CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');`,
            `CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');`,
            // Devices table
            `CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform device_platform NOT NULL,
        model VARCHAR(255),
        os_version VARCHAR(100),
        app_version VARCHAR(100),
        push_token TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE,
        name VARCHAR(255),
        device_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
            // Detections table with spatial data
            `CREATE TABLE IF NOT EXISTS detections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
        location GEOMETRY(POINT, 4326) NOT NULL,
        heading FLOAT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        traffic_light_state VARCHAR(50),
        bbox JSONB,
        confirmed BOOLEAN DEFAULT FALSE,
        cloud_processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
            // Traffic aggregated data
            `CREATE TABLE IF NOT EXISTS traffic (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        location GEOMETRY(POINT, 4326) NOT NULL,
        state VARCHAR(50) NOT NULL,
        confidence FLOAT NOT NULL,
        duration INTEGER DEFAULT 300,
        detection_ids UUID[] DEFAULT ARRAY[]::UUID[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
            // Alerts table
            `CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        detection_id UUID REFERENCES detections(id) ON DELETE CASCADE,
        alert_type VARCHAR(100) NOT NULL,
        severity alert_severity NOT NULL,
        message TEXT NOT NULL,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE
      );`,
            // Create spatial indexes for performance
            `CREATE INDEX IF NOT EXISTS idx_detections_location ON detections USING GIST (location);`,
            `CREATE INDEX IF NOT EXISTS idx_detections_timestamp ON detections (timestamp);`,
            `CREATE INDEX IF NOT EXISTS idx_detections_device_id ON detections (device_id);`,
            `CREATE INDEX IF NOT EXISTS idx_detections_created_at ON detections (created_at);`,
            `CREATE INDEX IF NOT EXISTS idx_traffic_location ON traffic USING GIST (location);`,
            `CREATE INDEX IF NOT EXISTS idx_traffic_updated_at ON traffic (updated_at);`,
            `CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices (last_seen);`,
            `CREATE INDEX IF NOT EXISTS idx_devices_platform ON devices (platform);`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);`,
            `CREATE INDEX IF NOT EXISTS idx_users_last_active ON users (last_active);`,
            `CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at);`,
            `CREATE INDEX IF NOT EXISTS idx_alerts_detection_id ON alerts (detection_id);`,
        ];
        const results = [];
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        // Execute each statement
        for (let i = 0; i < sqlStatements.length; i++) {
            const statement = sqlStatements[i];
            try {
                await pool.query(statement);
                results.push({
                    statement: i + 1,
                    status: 'success',
                    preview: statement.substring(0, 50) + '...',
                });
                successCount++;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                // Some statements might fail if they already exist
                if (errorMessage.includes('already exists') ||
                    (errorMessage.includes('relation') && errorMessage.includes('exists'))) {
                    results.push({
                        statement: i + 1,
                        status: 'skipped',
                        preview: statement.substring(0, 50) + '...',
                        reason: 'Already exists',
                    });
                    skipCount++;
                }
                else {
                    results.push({
                        statement: i + 1,
                        status: 'error',
                        preview: statement.substring(0, 50) + '...',
                        error: errorMessage,
                    });
                    errorCount++;
                }
            }
        }
        // Verify tables were created
        const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
        const tables = tablesResult.rows.map((row) => row.table_name);
        res.status(200).json({
            message: 'Database initialization completed (inline version)',
            summary: {
                totalStatements: sqlStatements.length,
                successful: successCount,
                skipped: skipCount,
                errors: errorCount,
                tablesCreated: tables.length,
            },
            tables: tables,
            details: results,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Database initialization error:', error);
        res.status(500).json({
            error: 'Database initialization failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });
    }
};
exports.initializeDatabaseInline = initializeDatabaseInline;
