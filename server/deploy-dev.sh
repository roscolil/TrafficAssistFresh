#!/bin/bash

# Traffic Assist - Development Deployment Script
# Deploys to a separate dev environment for testing

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

echo -e "${BLUE}🚀 Traffic Assist - Development Deployment${NC}"
echo "=========================================="
echo -e "${YELLOW}📋 This deploys to a separate DEV environment${NC}"
echo ""

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}📋 Current branch: ${CURRENT_BRANCH}${NC}"

if [ "$CURRENT_BRANCH" != "development" ]; then
    echo -e "${YELLOW}⚠️  Not on development branch. Switch to development branch?${NC}"
    read -p "Continue anyway? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

# Step 1: Build the container with dev tag
echo -e "${BLUE}🐳 Building development container image...${NC}"
gcloud builds submit --tag $IMAGE_NAME:dev .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Development build successful${NC}"

# Step 2: Check if dev secrets exist, create if needed
echo -e "${BLUE}🔐 Setting up development secrets...${NC}"

# Use development database (you can use a separate dev database or the same one)
if gcloud secrets describe database-url-dev >/dev/null 2>&1; then
    echo "Development database secret exists"
else
    echo -e "${YELLOW}📝 Development database secret not found${NC}"
    read -p "Enter development database URL (or press Enter to use production): " DEV_DATABASE_URL
    
    if [ -z "$DEV_DATABASE_URL" ]; then
        # Copy from production secret
        PROD_DB_URL=$(gcloud secrets versions access latest --secret="database-url")
        echo -n "$PROD_DB_URL" | gcloud secrets create database-url-dev --data-file=-
        echo "Using production database for development"
    else
        echo -n "$DEV_DATABASE_URL" | gcloud secrets create database-url-dev --data-file=-
        echo "Development database configured"
    fi
fi

# Create dev-specific API keys
API_KEY_DEV=$(openssl rand -base64 32)
echo -n "$API_KEY_DEV" | gcloud secrets create api-key-dev --data-file=- 2>/dev/null || \
echo -n "$API_KEY_DEV" | gcloud secrets versions add api-key-dev --data-file=-

JWT_SECRET_DEV=$(openssl rand -base64 32)
echo -n "$JWT_SECRET_DEV" | gcloud secrets create jwt-secret-dev --data-file=- 2>/dev/null || \
echo -n "$JWT_SECRET_DEV" | gcloud secrets versions add jwt-secret-dev --data-file=-

echo -e "${GREEN}✅ Development secrets configured${NC}"

# Step 3: Create dev storage bucket
echo -e "${BLUE}🪣 Setting up development storage...${NC}"
BUCKET_NAME_DEV="${PROJECT_ID}-dev-uploads"
gsutil mb -l $REGION gs://$BUCKET_NAME_DEV 2>/dev/null || echo "Dev bucket already exists"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME_DEV 2>/dev/null || echo "Dev permissions already set"

# Step 4: Deploy to Cloud Run with dev configuration
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

# Step 5: Get service URL and test
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

# Update frontend config for development
echo -e "${BLUE}🔧 Updating frontend for development...${NC}"

# Create development config override
cat > src/backend/config.development.ts << EOF
// Development configuration override
export const developmentConfig = {
  apiUrl: '$DEV_SERVICE_URL',
  wsUrl: '${DEV_SERVICE_URL/https/wss}',
  environment: 'web' as const,
  debug: true,
  logLevel: 'verbose'
};

// Auto-apply in development mode
if (typeof window !== 'undefined') {
  (window as any).__TRAFFIC_ASSIST_CONFIG__ = {
    REACT_APP_API_URL: '$DEV_SERVICE_URL',
    REACT_APP_WS_URL: '${DEV_SERVICE_URL/https/wss}',
    REACT_APP_ENVIRONMENT: 'development'
  };
}
EOF

echo -e "${GREEN}✅ Development frontend config created${NC}"

echo ""
echo -e "${BLUE}🎯 Development Environment Ready!${NC}"
echo ""
echo -e "${YELLOW}📱 For Frontend Development:${NC}"
echo "1. 🧪 Dev API: curl $DEV_SERVICE_URL/health"
echo "2. 🌐 Use dev URL: $DEV_SERVICE_URL"
echo "3. 📝 Config file: .env.development"
echo "4. 🔄 Frontend will auto-use dev config"
echo ""
echo -e "${BLUE}🔄 Workflow:${NC}"
echo "• Development: Use this branch + dev environment"
echo "• Production: Merge to main + deploy with production script"
echo ""
echo -e "${GREEN}✅ Development deployment complete! 🚧🚗${NC}"
