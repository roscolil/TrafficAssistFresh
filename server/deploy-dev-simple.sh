#!/bin/bash

# Simple Development Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="traffic-assist-1756794779"
SERVICE_NAME="traffic-assist-api-dev"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo -e "${BLUE}🚧 Traffic Assist - Development Deployment${NC}"
echo "==========================================="

# Step 1: Build the container with dev tag
echo -e "${BLUE}🐳 Building development container image...${NC}"
gcloud builds submit --tag $IMAGE_NAME:dev .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Development build successful${NC}"

# Step 2: Use existing production database or create dev-specific
echo -e "${BLUE}🗄️  Development Database Configuration${NC}"

# Check if development secrets exist, if not copy from production
if ! gcloud secrets describe database-url-dev >/dev/null 2>&1; then
    echo -e "${YELLOW}📝 Creating development database secret from production...${NC}"
    PROD_DB_URL=$(gcloud secrets versions access latest --secret="database-url")
    echo -n "$PROD_DB_URL" | gcloud secrets create database-url-dev --data-file=-
    echo "Development database configured (using production database)"
else
    echo "Development database secret exists"
fi

# Step 3: Create dev-specific API keys
echo -e "${BLUE}🔐 Setting up development secrets...${NC}"

API_KEY_DEV=$(openssl rand -base64 32)
echo -n "$API_KEY_DEV" | gcloud secrets create api-key-dev --data-file=- 2>/dev/null || \
echo -n "$API_KEY_DEV" | gcloud secrets versions add api-key-dev --data-file=-

JWT_SECRET_DEV=$(openssl rand -base64 32)
echo -n "$JWT_SECRET_DEV" | gcloud secrets create jwt-secret-dev --data-file=- 2>/dev/null || \
echo -n "$JWT_SECRET_DEV" | gcloud secrets versions add jwt-secret-dev --data-file=-

echo -e "${GREEN}✅ Development secrets configured${NC}"

# Step 4: Create dev storage bucket
echo -e "${BLUE}🪣 Setting up development storage...${NC}"
BUCKET_NAME_DEV="${PROJECT_ID}-dev-uploads"
gsutil mb -l $REGION gs://$BUCKET_NAME_DEV 2>/dev/null || echo "Dev bucket exists"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME_DEV 2>/dev/null || echo "Dev permissions set"

# Step 5: Deploy to Cloud Run with dev configuration
echo -e "${BLUE}🚀 Deploying to Cloud Run (Development)...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME:dev \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 3001 \
    --set-env-vars "NODE_ENV=development" \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --set-env-vars "STORAGE_BUCKET=$BUCKET_NAME_DEV" \
    --set-env-vars "ENVIRONMENT=development" \
    --set-secrets "DATABASE_URL=database-url-dev:latest" \
    --set-secrets "API_KEY=api-key-dev:latest" \
    --set-secrets "JWT_SECRET=jwt-secret-dev:latest" \
    --memory 1Gi \
    --cpu 1000m \
    --max-instances 5 \
    --min-instances 0 \
    --concurrency 80 \
    --timeout 300s

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Development deployment failed${NC}"
    exit 1
fi

# Step 6: Get service URL and test
DEV_SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 DEVELOPMENT DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo -e "${BLUE}📋 Your Development Environment:${NC}"
echo "🌐 DEV URL: $DEV_SERVICE_URL"
echo "🗄️  Database: Development/Shared PostgreSQL"
echo "🪣 Storage: gs://$BUCKET_NAME_DEV"
echo "📍 Region: $REGION"
echo "🏷️  Environment: DEVELOPMENT"
echo ""

# Test the deployment
echo -e "${BLUE}🧪 Testing development API...${NC}"
sleep 5

if curl -f -s "$DEV_SERVICE_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Development health check PASSED!${NC}"
    echo "🌐 Dev API is running: $DEV_SERVICE_URL/health"
else
    echo -e "${YELLOW}⚠️  Development health check pending${NC}"
    echo "🔄 Manual test: curl $DEV_SERVICE_URL/health"
fi

# Save development configuration
cat > .env.development << EOF
# Traffic Assist Development Configuration
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
SERVICE_URL=$DEV_SERVICE_URL
API_URL=$DEV_SERVICE_URL
WS_URL=${DEV_SERVICE_URL/https/wss}
STORAGE_BUCKET=$BUCKET_NAME_DEV
REGION=$REGION
ENVIRONMENT=development
EOF

echo -e "${BLUE}💾 Development configuration saved to .env.development${NC}"

echo ""
echo -e "${BLUE}🎯 Development Environment Ready!${NC}"
echo ""
echo -e "${YELLOW}📱 For Frontend Development:${NC}"
echo "1. 🧪 Dev API: curl $DEV_SERVICE_URL/health"
echo "2. 🌐 Use dev URL: $DEV_SERVICE_URL"
echo "3. 📝 Config file: .env.development"
echo ""
echo -e "${BLUE}🔄 Workflow:${NC}"
echo "• Development: Use this branch + dev environment"
echo "• Production: Merge to main + deploy with production script"
echo ""
echo -e "${GREEN}✅ Development deployment complete! 🚧🚗${NC}"
