#!/bin/bash

# Traffic Assist - Alternative Deployment Script
# For organizations with Cloud SQL restrictions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Traffic Assist - Alternative Deployment${NC}"
echo "============================================"
echo -e "${YELLOW}📋 This script avoids Cloud SQL due to org restrictions${NC}"
echo -e "${YELLOW}📋 Options: External DB, Cloud Run with SQLite, or containerized PostgreSQL${NC}"
echo ""

# Check if we have a project from the creation script
if [ -f ".env.deploy" ]; then
    source .env.deploy
    echo -e "${BLUE}📋 Using project from .env.deploy: ${GOOGLE_CLOUD_PROJECT_ID}${NC}"
    PROJECT_ID=$GOOGLE_CLOUD_PROJECT_ID
else
    # Generate new project ID if not provided
    PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"traffic-assist-$(date +%s)"}
    echo -e "${BLUE}📋 Creating new project: ${PROJECT_ID}${NC}"
    
    # Create project
    gcloud projects create $PROJECT_ID --name="Traffic Assist Production"
    gcloud config set project $PROJECT_ID
    echo "GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID}" > .env.deploy
    GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
fi

# Set project as active
gcloud config set project $PROJECT_ID

echo -e "${GREEN}✅ Active project: ${PROJECT_ID}${NC}"

# Database options menu
echo -e "${BLUE}🗄️  Database Options:${NC}"
echo "1. External PostgreSQL (Neon, Supabase, etc.)"
echo "2. Cloud Run with SQLite (development/testing)"
echo "3. Container with PostgreSQL (Cloud Run with sidecar)"
echo "4. Skip database setup (manual configuration)"
echo ""

read -p "Choose database option (1-4): " db_option

case $db_option in
    1)
        echo -e "${BLUE}📝 External PostgreSQL Setup${NC}"
        echo "Please provide your external PostgreSQL connection details:"
        read -p "Database Host: " DB_HOST
        read -p "Database Port (5432): " DB_PORT
        DB_PORT=${DB_PORT:-5432}
        read -p "Database Name: " DB_NAME
        read -p "Database User: " DB_USER
        read -s -p "Database Password: " DB_PASSWORD
        echo ""
        
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        ;;
    2)
        echo -e "${BLUE}💾 SQLite Configuration${NC}"
        DATABASE_URL="sqlite:./data/traffic_assist.db"
        echo -e "${YELLOW}⚠️  Note: SQLite is suitable for development/testing only${NC}"
        ;;
    3)
        echo -e "${BLUE}🐳 Containerized PostgreSQL${NC}"
        DATABASE_URL="postgresql://postgres:postgres@localhost:5432/traffic_assist"
        echo -e "${YELLOW}⚠️  Note: This will run PostgreSQL in the same container${NC}"
        ;;
    4)
        echo -e "${BLUE}⏭️  Skipping database setup${NC}"
        DATABASE_URL="postgresql://localhost:5432/traffic_assist"
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

# Enable APIs (excluding Cloud SQL)
echo -e "${BLUE}🔌 Enabling Google Cloud APIs (excluding Cloud SQL)...${NC}"

# Core APIs first
echo -e "${BLUE}  Enabling core APIs...${NC}"
gcloud services enable \
    serviceusage.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    compute.googleapis.com

sleep 5

# Storage and secret APIs
echo -e "${BLUE}  Enabling storage and secret APIs...${NC}"
gcloud services enable \
    storage.googleapis.com \
    secretmanager.googleapis.com

sleep 5

# Application APIs
echo -e "${BLUE}  Enabling application APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    pubsub.googleapis.com \
    cloudbuild.googleapis.com

echo -e "${GREEN}✅ All available APIs enabled${NC}"

# Configuration
REGION="us-central1"
SERVICE_NAME="traffic-assist-api"

# Create secrets for database connection
echo -e "${BLUE}🔐 Creating secrets...${NC}"

echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=-

# Create other secrets
API_KEY=$(openssl rand -base64 32)
echo -n "$API_KEY" | gcloud secrets create api-key --data-file=-

JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

echo -e "${GREEN}✅ Secrets created${NC}"

# Create Cloud Storage bucket for uploads
echo -e "${BLUE}🪣 Creating Cloud Storage bucket...${NC}"
BUCKET_NAME="${PROJECT_ID}-uploads"

gsutil mb -l $REGION gs://$BUCKET_NAME
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

echo -e "${GREEN}✅ Storage bucket created: ${BUCKET_NAME}${NC}"

# Create Pub/Sub topics
echo -e "${BLUE}📡 Creating Pub/Sub topics...${NC}"

gcloud pubsub topics create traffic-detections
gcloud pubsub topics create analytics-events
gcloud pubsub topics create notifications

gcloud pubsub subscriptions create traffic-processor --topic=traffic-detections
gcloud pubsub subscriptions create analytics-processor --topic=analytics-events
gcloud pubsub subscriptions create notification-sender --topic=notifications

echo -e "${GREEN}✅ Pub/Sub topics and subscriptions created${NC}"

# Create appropriate Dockerfile based on database choice
echo -e "${BLUE}🐳 Creating deployment configuration...${NC}"

if [ "$db_option" = "2" ]; then
    # SQLite Dockerfile
    cat > Dockerfile.deploy << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache sqlite

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

CMD ["node", "dist/server.js"]
EOF

elif [ "$db_option" = "3" ]; then
    # PostgreSQL container Dockerfile
    cat > Dockerfile.deploy << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install PostgreSQL
RUN apk add --no-cache postgresql postgresql-contrib

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Create PostgreSQL data directory
RUN mkdir -p /var/lib/postgresql/data
RUN adduser -D postgres
RUN chown -R postgres:postgres /var/lib/postgresql

# Initialize PostgreSQL
USER postgres
RUN initdb -D /var/lib/postgresql/data
RUN echo "host all all 127.0.0.1/32 trust" >> /var/lib/postgresql/data/pg_hba.conf
RUN echo "listen_addresses='localhost'" >> /var/lib/postgresql/data/postgresql.conf

# Switch back to root for startup script
USER root

# Create startup script
RUN cat > /app/start.sh << 'SCRIPT'
#!/bin/sh
su - postgres -c 'pg_ctl -D /var/lib/postgresql/data start'
sleep 2
su - postgres -c 'createdb traffic_assist'
cd /app && node dist/server.js
SCRIPT

RUN chmod +x /app/start.sh

# Create non-root user for app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

EXPOSE 3001

CMD ["/app/start.sh"]
EOF

else
    # External database Dockerfile
    cat > Dockerfile.deploy << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

CMD ["node", "dist/server.js"]
EOF
fi

# Build and deploy to Cloud Run
echo -e "${BLUE}🚀 Building and deploying to Cloud Run...${NC}"

# Build the container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME -f Dockerfile.deploy .

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production" \
    --set-secrets "DATABASE_URL=database-url:latest" \
    --set-secrets "API_KEY=api-key:latest" \
    --set-secrets "JWT_SECRET=jwt-secret:latest" \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --set-env-vars "STORAGE_BUCKET=$BUCKET_NAME" \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Information:${NC}"
echo "Project ID: $PROJECT_ID"
echo "Service URL: $SERVICE_URL"
echo "Database: $DATABASE_URL"
echo "Storage Bucket: gs://$BUCKET_NAME"
echo ""

# Save deployment info
cat > .env.production << EOF
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
SERVICE_URL=$SERVICE_URL
DATABASE_URL=$DATABASE_URL
STORAGE_BUCKET=$BUCKET_NAME
REGION=$REGION
EOF

echo -e "${BLUE}💾 Configuration saved to .env.production${NC}"

# Display next steps
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. Test your API: curl $SERVICE_URL/health"
echo "2. Update your frontend config to use: $SERVICE_URL"
echo "3. Test database connection: curl $SERVICE_URL/api/health/db"

if [ "$db_option" = "1" ]; then
    echo "4. Ensure your external database is accessible from Cloud Run"
    echo "5. Run database migrations if needed"
fi

echo ""
echo -e "${GREEN}🎉 Traffic Assist deployed successfully!${NC}"
