#!/bin/bash

# Quick test deployment with SQLite (for testing deployment process)
# You can switch to real PostgreSQL later

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Traffic Assist - Test Deploy (SQLite)${NC}"
echo "========================================"
echo -e "${YELLOW}📋 This uses SQLite for quick testing - switch to PostgreSQL for production${NC}"
echo ""

# Use current project
PROJECT_ID=$(gcloud config get-value project)
echo -e "${GREEN}✅ Using project: ${PROJECT_ID}${NC}"

# Enable required APIs
echo -e "${BLUE}🔌 Enabling required Google Cloud APIs...${NC}"

gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com

echo -e "${GREEN}✅ APIs enabled${NC}"

# Create secrets
echo -e "${BLUE}🔐 Creating secrets...${NC}"

DATABASE_URL="sqlite:./data/traffic_assist.db"
API_KEY=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

echo -n "$API_KEY" | gcloud secrets create api-key --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$API_KEY" | gcloud secrets versions add api-key --data-file=-

echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

echo -e "${GREEN}✅ Secrets created${NC}"

# Create storage bucket
echo -e "${BLUE}🪣 Creating storage bucket...${NC}"
BUCKET_NAME="${PROJECT_ID}-traffic-uploads"

gsutil mb -l us-central1 gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"

echo -e "${GREEN}✅ Storage bucket ready${NC}"

# Create Dockerfile for SQLite
echo -e "${BLUE}🐳 Creating SQLite deployment configuration...${NC}"

cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install SQLite
RUN apk add --no-cache sqlite

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

CMD ["node", "dist/server.js"]
EOF

# Build and deploy
echo -e "${BLUE}🚀 Building and deploying to Cloud Run...${NC}"

SERVICE_NAME="traffic-assist-api"
REGION="us-central1"

gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .

gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,STORAGE_BUCKET=$BUCKET_NAME" \
    --set-secrets "DATABASE_URL=database-url:latest,API_KEY=api-key:latest,JWT_SECRET=jwt-secret:latest" \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 5

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 Test deployment successful!${NC}"
echo ""
echo -e "${BLUE}📋 Your Traffic Assist API (Test):${NC}"
echo "🌐 URL: $SERVICE_URL"
echo "🗄️  Database: SQLite (temporary)"
echo "📍 Region: $REGION"
echo ""

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
sleep 10
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  API may still be starting up${NC}"
fi

# Save configuration
cat > .env.test << EOF
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
SERVICE_URL=$SERVICE_URL
DATABASE_URL=$DATABASE_URL
STORAGE_BUCKET=$BUCKET_NAME
REGION=$REGION
EOF

echo -e "${BLUE}💾 Test configuration saved to .env.test${NC}"

echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. 🧪 Test: curl $SERVICE_URL/health"
echo "2. 🗄️  For production: Set up PostgreSQL and redeploy"
echo "3. 📱 Update frontend to use: $SERVICE_URL"

rm -f Dockerfile

echo -e "${GREEN}✅ Test deployment complete!${NC}"
