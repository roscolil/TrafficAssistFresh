#!/bin/bash

# Traffic Assist Local Development Setup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏠 Setting up Traffic Assist Local Development Environment${NC}"
echo "=========================================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not found. Installing via Homebrew...${NC}"
    if ! command -v brew &> /dev/null; then
        echo -e "${RED}❌ Homebrew not found. Please install Homebrew first.${NC}"
        exit 1
    fi
    brew install postgresql@15 postgis
    brew services start postgresql@15
else
    echo -e "${GREEN}✅ PostgreSQL found${NC}"
fi

# Check if PostGIS is available
echo -e "${BLUE}🗺️  Checking PostGIS availability...${NC}"
if ! psql postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;" &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostGIS not available. Installing...${NC}"
    brew install postgis
fi

# Create database and user
echo -e "${BLUE}🗄️  Setting up local database...${NC}"
DB_NAME="traffic_assist_dev"
DB_USER="traffic_assist_user"
DB_PASSWORD="dev_password_123"

# Create user if not exists
psql postgres -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || \
psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

# Create database if not exists
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Grant privileges
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo -e "${GREEN}✅ Database setup complete${NC}"

# Initialize database schema
echo -e "${BLUE}📋 Initializing database schema...${NC}"
psql -d $DB_NAME -U $DB_USER -f src/db/init.sql

echo -e "${GREEN}✅ Database schema initialized${NC}"

# Create local .env file
echo -e "${BLUE}⚙️  Creating local environment file...${NC}"
cat > .env << EOF
# Local Development Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL=false

# Google Cloud Configuration (for development)
GOOGLE_CLOUD_PROJECT_ID=traffic-assist-dev
GOOGLE_CLOUD_REGION=us-central1

# Development Pub/Sub (using local emulator)
PUBSUB_EMULATOR_HOST=localhost:8085
PUBSUB_TRAFFIC_EVENTS_TOPIC=traffic-events
PUBSUB_TRAFFIC_UPDATES_TOPIC=traffic-updates
PUBSUB_ALERTS_TOPIC=alerts

# Security Configuration
JWT_SECRET=dev-jwt-secret-change-in-production
CORS_ORIGIN=http://localhost:3000,http://localhost:19006

# Rate Limiting (relaxed for development)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Development flags
ENABLE_ANALYTICS=true
ENABLE_SAMPLE_DATA=true
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true

# Performance Configuration
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Geospatial Configuration
DEFAULT_SEARCH_RADIUS=1000
MAX_SEARCH_RADIUS=10000
LOCATION_GRID_SIZE=0.001
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Install dependencies if not already done
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    pnpm install
fi

# Build the project
echo -e "${BLUE}🏗️  Building TypeScript...${NC}"
pnpm build

echo -e "${GREEN}🎉 Local development setup complete!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo "  pnpm dev          - Start development server with hot reload"
echo "  pnpm build        - Build the TypeScript project"
echo "  pnpm start        - Start production server"
echo "  pnpm test         - Run tests"
echo ""
echo -e "${BLUE}Database connection:${NC}"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo -e "${BLUE}API will be available at:${NC}"
echo "  http://localhost:3001"
echo ""
echo -e "${YELLOW}To start the development server, run:${NC}"
echo "  cd /Users/ross/Documents/TrueSignal/truesignal/TrafficAssistFresh/server"
echo "  pnpm dev"
