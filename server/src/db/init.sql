-- Traffic Assist Database Schema
-- PostgreSQL with PostGIS extension for spatial data

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum types
CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY,
    platform device_platform NOT NULL,
    model VARCHAR(255),
    os_version VARCHAR(100),
    app_version VARCHAR(100),
    push_token TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    device_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detections table with spatial data
CREATE TABLE detections (
    id UUID PRIMARY KEY,
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
);

-- Traffic aggregated data
CREATE TABLE traffic (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    state VARCHAR(50) NOT NULL,
    confidence FLOAT NOT NULL,
    duration INTEGER DEFAULT 300, -- seconds
    detection_ids UUID[] DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id UUID REFERENCES detections(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    severity alert_severity NOT NULL,
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create spatial indexes for performance
CREATE INDEX idx_detections_location ON detections USING GIST (location);
CREATE INDEX idx_detections_timestamp ON detections (timestamp);
CREATE INDEX idx_detections_device_id ON detections (device_id);
CREATE INDEX idx_detections_created_at ON detections (created_at);

CREATE INDEX idx_traffic_location ON traffic USING GIST (location);
CREATE INDEX idx_traffic_updated_at ON traffic (updated_at);

CREATE INDEX idx_devices_last_seen ON devices (last_seen);
CREATE INDEX idx_devices_platform ON devices (platform);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_last_active ON users (last_active);

CREATE INDEX idx_alerts_created_at ON alerts (created_at);
CREATE INDEX idx_alerts_detection_id ON alerts (detection_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_detections_updated_at BEFORE UPDATE
    ON detections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_traffic_updated_at BEFORE UPDATE
    ON traffic FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for geographic proximity queries
CREATE OR REPLACE FUNCTION get_nearby_detections(
    input_lat FLOAT,
    input_lng FLOAT,
    radius_meters INTEGER DEFAULT 1000,
    time_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    device_id UUID,
    latitude FLOAT,
    longitude FLOAT,
    confidence FLOAT,
    traffic_light_state VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE,
    distance_meters FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.device_id,
        ST_Y(d.location) as latitude,
        ST_X(d.location) as longitude,
        d.confidence,
        d.traffic_light_state,
        d.timestamp,
        ST_Distance(
            d.location::geography,
            ST_SetSRID(ST_MakePoint(input_lng, input_lat), 4326)::geography
        ) as distance_meters
    FROM detections d
    WHERE ST_DWithin(
        d.location::geography,
        ST_SetSRID(ST_MakePoint(input_lng, input_lat), 4326)::geography,
        radius_meters
    )
    AND d.timestamp > NOW() - INTERVAL '1 minute' * time_window_minutes
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function for traffic density analysis
CREATE OR REPLACE FUNCTION get_traffic_density_grid(
    sw_lat FLOAT,
    sw_lng FLOAT,
    ne_lat FLOAT,
    ne_lng FLOAT,
    grid_size FLOAT DEFAULT 0.001,
    time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    grid_lat FLOAT,
    grid_lng FLOAT,
    detection_count BIGINT,
    avg_confidence FLOAT,
    dominant_state VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ST_Y(ST_SnapToGrid(d.location, grid_size)) as grid_lat,
        ST_X(ST_SnapToGrid(d.location, grid_size)) as grid_lng,
        COUNT(*) as detection_count,
        AVG(d.confidence) as avg_confidence,
        MODE() WITHIN GROUP (ORDER BY d.traffic_light_state) as dominant_state
    FROM detections d
    WHERE ST_Within(
        d.location,
        ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
    )
    AND d.created_at > NOW() - INTERVAL '1 hour' * time_window_hours
    GROUP BY ST_SnapToGrid(d.location, grid_size)
    HAVING COUNT(*) >= 2
    ORDER BY detection_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing (optional)
-- You can uncomment this section for development testing

/*
-- Sample devices
INSERT INTO devices (id, platform, model, os_version, app_version) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'ios', 'iPhone 14', '17.0', '1.0.0'),
    ('550e8400-e29b-41d4-a716-446655440002', 'android', 'Pixel 7', '14', '1.0.0'),
    ('550e8400-e29b-41d4-a716-446655440003', 'web', 'Chrome', '118.0', '1.0.0');

-- Sample users
INSERT INTO users (id, email, name, device_ids) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'user1@example.com', 'Test User 1', 
     ARRAY['550e8400-e29b-41d4-a716-446655440001']),
    ('660e8400-e29b-41d4-a716-446655440002', 'user2@example.com', 'Test User 2', 
     ARRAY['550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003']);

-- Sample detections (San Francisco coordinates)
INSERT INTO detections (id, device_id, location, heading, timestamp, confidence, traffic_light_state) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 
     ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326), 90.0, NOW() - INTERVAL '5 minutes', 0.85, 'red'),
    ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 
     ST_SetSRID(ST_MakePoint(-122.4094, 37.7849), 4326), 180.0, NOW() - INTERVAL '3 minutes', 0.92, 'green'),
    ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 
     ST_SetSRID(ST_MakePoint(-122.4294, 37.7649), 4326), 0.0, NOW() - INTERVAL '1 minute', 0.78, 'yellow');
*/

-- Create analytics views for performance
CREATE OR REPLACE VIEW detection_summary AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_detections,
    COUNT(DISTINCT device_id) as unique_devices,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN traffic_light_state = 'red' THEN 1 END) as red_lights,
    COUNT(CASE WHEN traffic_light_state = 'yellow' THEN 1 END) as yellow_lights,
    COUNT(CASE WHEN traffic_light_state = 'green' THEN 1 END) as green_lights
FROM detections
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

CREATE OR REPLACE VIEW device_activity AS
SELECT 
    d.id,
    d.platform,
    d.model,
    COUNT(det.id) as total_detections,
    MAX(det.created_at) as last_detection,
    AVG(det.confidence) as avg_confidence
FROM devices d
LEFT JOIN detections det ON det.device_id = d.id
WHERE d.last_seen > NOW() - INTERVAL '24 hours'
GROUP BY d.id, d.platform, d.model
ORDER BY total_detections DESC;

-- Grant permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;
