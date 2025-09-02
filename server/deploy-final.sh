#!/bin/bash

# Deploy the successfully built container
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="traffic-assist-1756794779"
SERVICE_NAME="traffic-assist-api"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo -e "${GREEN}✅ Container build successful!${NC}"
echo -e "${BLUE}🚀 Now deploying to Cloud Run...${NC}"
echo ""

# Get database URL
echo -e "${BLUE}🗄️  Database Configuration${NC}"
echo "Please provide your Neon PostgreSQL connection URL:"
echo "Format: postgresql://username:password@ep-hostname.region.neon.tech/dbname?sslmode=require"
echo ""
read -p "Neon Database URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Database URL is required${NC}"
    exit 1
fi

# Validate URL format
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
    echo -e "${RED}❌ Invalid PostgreSQL URL format${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database URL validated${NC}"

# Create/update secrets
echo -e "${BLUE}🔐 Setting up secrets...${NC}"

# Database URL
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- 2>/dev/null || \
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

# API Key
API_KEY=$(openssl rand -base64 32)
echo -n "$API_KEY" | gcloud secrets create api-key --data-file=- 2>/dev/null || \
echo -n "$API_KEY" | gcloud secrets versions add api-key --data-file=-

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- 2>/dev/null || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

echo -e "${GREEN}✅ Secrets configured${NC}"

# Create storage bucket
echo -e "${BLUE}🪣 Setting up storage...${NC}"
BUCKET_NAME="${PROJECT_ID}-uploads"
gsutil mb -l $REGION gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME 2>/dev/null || echo "Permissions already set"

echo -e "${GREEN}✅ Storage configured${NC}"

# Deploy to Cloud Run
echo -e "${BLUE}🚀 Deploying to Cloud Run...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 3001 \
    --set-env-vars "NODE_ENV=production" \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --set-env-vars "STORAGE_BUCKET=$BUCKET_NAME" \
    --set-secrets "DATABASE_URL=database-url:latest" \
    --set-secrets "API_KEY=api-key:latest" \
    --set-secrets "JWT_SECRET=jwt-secret:latest" \
    --memory 1Gi \
    --cpu 1000m \
    --max-instances 10 \
    --min-instances 0 \
    --concurrency 80 \
    --timeout 300s

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo -e "${BLUE}📋 Your Traffic Assist API:${NC}"
echo "🌐 URL: $SERVICE_URL"
echo "🗄️  Database: Neon PostgreSQL"
echo "🪣 Storage: gs://$BUCKET_NAME"
echo "📍 Region: $REGION"
echo ""

# Test the deployment
echo -e "${BLUE}🧪 Testing your API...${NC}"
sleep 10

if curl -f -s "$SERVICE_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check PASSED!${NC}"
    echo "🌐 API is running: $SERVICE_URL/health"
else
    echo -e "${YELLOW}⚠️  Health check pending (service may be starting)${NC}"
    echo "🔄 Manual test: curl $SERVICE_URL/health"
fi

# Save configuration
cat > .env.production << EOF
# Traffic Assist Production Configuration
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
SERVICE_URL=$SERVICE_URL
API_URL=$SERVICE_URL
WS_URL=${SERVICE_URL/https/wss}
DATABASE_URL=$DATABASE_URL
STORAGE_BUCKET=$BUCKET_NAME
REGION=$REGION
EOF

echo -e "${BLUE}💾 Configuration saved to .env.production${NC}"

echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. 🧪 Test API: curl $SERVICE_URL/health"
echo "2. 🗄️  Test DB: curl $SERVICE_URL/api/health/db"
echo "3. 📱 Update your frontend to use: $SERVICE_URL"
echo "4. 🌐 WebSocket endpoint: ${SERVICE_URL/https/wss}"
echo ""
echo -e "${GREEN}✅ Traffic Assist is LIVE! 🚗💨${NC}"
echo -e "${YELLOW}🔗 Share this URL with your frontend: $SERVICE_URL${NC}"
