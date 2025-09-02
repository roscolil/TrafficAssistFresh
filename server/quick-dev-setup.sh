#!/bin/bash

# Quick Development Service Creation
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="traffic-assist-1756794779"
PROD_SERVICE="traffic-assist-api"
DEV_SERVICE="traffic-assist-api-dev"
REGION="us-central1"

echo -e "${BLUE}🚧 Quick Development Service Setup${NC}"
echo "=================================="

# Get the current production image
echo -e "${BLUE}📋 Getting production service info...${NC}"
PROD_IMAGE=$(gcloud run services describe $PROD_SERVICE --region=$REGION --format='value(spec.template.spec.template.spec.containers[0].image)' 2>/dev/null || echo "")

if [ -z "$PROD_IMAGE" ]; then
    echo -e "${YELLOW}⚠️  Production service not found, using latest built image...${NC}"
    PROD_IMAGE="gcr.io/$PROJECT_ID/$PROD_SERVICE:latest"
fi

echo "Production image: $PROD_IMAGE"

# Create development secrets (copy from production if needed)
echo -e "${BLUE}🔐 Setting up development secrets...${NC}"

# Copy database URL from production for development
if ! gcloud secrets describe database-url-dev >/dev/null 2>&1; then
    echo "Creating dev database secret..."
    PROD_DB_URL=$(gcloud secrets versions access latest --secret="database-url")
    echo -n "$PROD_DB_URL" | gcloud secrets create database-url-dev --data-file=-
fi

# Create unique API key for dev
API_KEY_DEV=$(openssl rand -base64 32)
echo -n "$API_KEY_DEV" | gcloud secrets create api-key-dev --data-file=- 2>/dev/null || \
echo -n "$API_KEY_DEV" | gcloud secrets versions add api-key-dev --data-file=-

# Create unique JWT secret for dev
JWT_SECRET_DEV=$(openssl rand -base64 32)
echo -n "$JWT_SECRET_DEV" | gcloud secrets create jwt-secret-dev --data-file=- 2>/dev/null || \
echo -n "$JWT_SECRET_DEV" | gcloud secrets versions add jwt-secret-dev --data-file=-

echo -e "${GREEN}✅ Development secrets ready${NC}"

# Create development storage bucket
echo -e "${BLUE}🪣 Setting up development storage...${NC}"
BUCKET_NAME_DEV="${PROJECT_ID}-dev-uploads"
gsutil mb -l $REGION gs://$BUCKET_NAME_DEV 2>/dev/null || echo "Dev bucket exists"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME_DEV 2>/dev/null || true

# Deploy development service using production image
echo -e "${BLUE}🚀 Creating development service...${NC}"

gcloud run deploy $DEV_SERVICE \
    --image $PROD_IMAGE \
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
    echo -e "${RED}❌ Development service creation failed${NC}"
    exit 1
fi

# Get development service URL
DEV_SERVICE_URL=$(gcloud run services describe $DEV_SERVICE --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 DEVELOPMENT SERVICE CREATED!${NC}"
echo ""
echo -e "${BLUE}📋 Your Development Environment:${NC}"
echo "🌐 DEV URL: $DEV_SERVICE_URL"
echo "🗄️  Database: Shared PostgreSQL (same as production)"
echo "🪣 Storage: gs://$BUCKET_NAME_DEV"
echo "📍 Region: $REGION"
echo "🏷️  Environment: DEVELOPMENT"
echo "🚀 Image: $PROD_IMAGE (same as production)"
echo ""

# Test the development service
echo -e "${BLUE}🧪 Testing development service...${NC}"
sleep 3

if curl -f -s "$DEV_SERVICE_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Development service health check PASSED!${NC}"
    echo "🌐 Dev API is running: $DEV_SERVICE_URL/health"
    
    # Test a few endpoints
    echo -e "${BLUE}🔍 Testing endpoints...${NC}"
    curl -s "$DEV_SERVICE_URL/health" | head -3
else
    echo -e "${YELLOW}⚠️  Development service starting up...${NC}"
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

echo ""
echo -e "${BLUE}💾 Development configuration saved to .env.development${NC}"

echo ""
echo -e "${GREEN}✅ Development environment is ready! 🚧🚗${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. 🧪 Test: curl $DEV_SERVICE_URL/health"
echo "2. 🔄 To update dev with new code, rebuild and redeploy"
echo "3. 🌐 Frontend can use: $DEV_SERVICE_URL"
echo ""
echo -e "${BLUE}🎯 Happy developing!${NC}"
