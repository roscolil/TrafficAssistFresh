#!/bin/bash

# Quick deployment with external PostgreSQL (Neon/Supabase)
# This script avoids Cloud SQL completely

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Traffic Assist - Quick Deploy (External DB)${NC}"
echo "=============================================="
echo ""
echo -e "${YELLOW}📋 This deployment uses external PostgreSQL to avoid Cloud SQL restrictions${NC}"
echo -e "${BLUE}🆓 Recommended free options:${NC}"
echo "  • Neon (https://neon.tech) - Free tier: 512MB storage"
echo "  • Supabase (https://supabase.com) - Free tier: 500MB storage"
echo "  • ElephantSQL (https://www.elephantsql.com) - Free tier: 20MB storage"
echo "  • Aiven (https://aiven.io) - Free trial"
echo ""

# Check current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  No active Google Cloud project found${NC}"
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    gcloud config set project $PROJECT_ID
fi

echo -e "${GREEN}✅ Using project: ${PROJECT_ID}${NC}"

# Get database URL
echo -e "${BLUE}🗄️  Database Setup${NC}"
echo "Please create a PostgreSQL database using one of the free services above"
echo "Then provide the connection URL:"
echo ""
echo "Example formats:"
echo "  Neon: postgresql://username:password@ep-hostname.region.neon.tech/dbname?sslmode=require"
echo "  Supabase: postgresql://postgres:password@hostname.supabase.co:5432/postgres"
echo ""

read -p "Database URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Database URL is required${NC}"
    exit 1
fi

# Validate URL format
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
    echo -e "${RED}❌ Invalid PostgreSQL URL format${NC}"
    exit 1
fi

# Enable required APIs (no Cloud SQL)
echo -e "${BLUE}🔌 Enabling required Google Cloud APIs...${NC}"

gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    pubsub.googleapis.com

echo -e "${GREEN}✅ APIs enabled${NC}"

# Create secrets
echo -e "${BLUE}🔐 Creating secrets...${NC}"

# Store database URL securely
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

# Generate API key and JWT secret
API_KEY=$(openssl rand -base64 32)
echo -n "$API_KEY" | gcloud secrets create api-key --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$API_KEY" | gcloud secrets versions add api-key --data-file=-

JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

echo -e "${GREEN}✅ Secrets created${NC}"

# Create storage bucket
echo -e "${BLUE}🪣 Creating storage bucket...${NC}"
BUCKET_NAME="${PROJECT_ID}-traffic-uploads"

gsutil mb -l us-central1 gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

echo -e "${GREEN}✅ Storage bucket ready: ${BUCKET_NAME}${NC}"

# Create Pub/Sub topics
echo -e "${BLUE}📡 Creating Pub/Sub topics...${NC}"

gcloud pubsub topics create traffic-detections 2>/dev/null || echo "Topic already exists"
gcloud pubsub topics create analytics-events 2>/dev/null || echo "Topic already exists"

gcloud pubsub subscriptions create traffic-processor --topic=traffic-detections 2>/dev/null || echo "Subscription already exists"
gcloud pubsub subscriptions create analytics-processor --topic=analytics-events 2>/dev/null || echo "Subscription already exists"

echo -e "${GREEN}✅ Pub/Sub configured${NC}"

# Create optimized Dockerfile
echo -e "${BLUE}🐳 Creating deployment configuration...${NC}"

cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install security updates
RUN apk update && apk upgrade

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "dist/server.js"]
EOF

# Build and deploy
echo -e "${BLUE}🚀 Building and deploying to Cloud Run...${NC}"

SERVICE_NAME="traffic-assist-api"
REGION="us-central1"

# Build container using default Dockerfile
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .

# Deploy with external database
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,STORAGE_BUCKET=$BUCKET_NAME" \
    --set-secrets "DATABASE_URL=database-url:latest,API_KEY=api-key:latest,JWT_SECRET=jwt-secret:latest" \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --concurrency 100 \
    --timeout 300

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo ""
echo -e "${BLUE}📋 Your Traffic Assist API:${NC}"
echo "🌐 URL: $SERVICE_URL"
echo "🗄️  Database: External PostgreSQL"
echo "🪣 Storage: gs://$BUCKET_NAME"
echo "📍 Region: $REGION"
echo ""

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  API health check pending (may take a moment to start)${NC}"
fi

# Save configuration
cat > .env.production << EOF
# Traffic Assist Production Configuration
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
SERVICE_URL=$SERVICE_URL
DATABASE_URL=$DATABASE_URL
STORAGE_BUCKET=$BUCKET_NAME
REGION=$REGION
API_URL=$SERVICE_URL
WS_URL=${SERVICE_URL/https/wss}
EOF

echo -e "${BLUE}💾 Configuration saved to .env.production${NC}"

# Update frontend config
echo -e "${BLUE}🔧 Updating frontend configuration...${NC}"

# Check if config exists and update it
if [ -f "../src/backend/config.ts" ]; then
    # Create production config override
    cat > ../src/backend/config.production.ts << EOF
// Production configuration for deployed backend
export const productionConfig = {
  apiUrl: '$SERVICE_URL',
  wsUrl: '${SERVICE_URL/https/wss}',
  environment: 'web' as const
};
EOF
    echo -e "${GREEN}✅ Frontend config updated${NC}"
fi

# Display next steps
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. 🧪 Test API: curl $SERVICE_URL/health"
echo "2. 🗄️  Test DB: curl $SERVICE_URL/api/health/db"
echo "3. 📱 Update your app to use: $SERVICE_URL"
echo "4. 🌐 Deploy frontend with updated config"
echo ""
echo -e "${BLUE}📱 Frontend Integration:${NC}"
echo "Add this to your frontend environment:"
echo "REACT_APP_API_URL=$SERVICE_URL"
echo "REACT_APP_WS_URL=${SERVICE_URL/https/wss}"
echo ""
echo -e "${GREEN}✅ Traffic Assist is now live at: $SERVICE_URL${NC}"

# Cleanup
rm -f Dockerfile

echo -e "${BLUE}🧹 Deployment files cleaned up${NC}"
