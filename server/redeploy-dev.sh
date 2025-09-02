#!/bin/bash

# Development Rebuild and Deploy
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

echo -e "${BLUE}🔄 Development Rebuild & Redeploy${NC}"
echo "================================="

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo -e "${BLUE}📋 Current branch: ${CURRENT_BRANCH}${NC}"

# Build new image
echo -e "${BLUE}🐳 Building updated development image...${NC}"
gcloud builds submit --tag $IMAGE_NAME:latest .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Redeploy to development service
echo -e "${BLUE}🚀 Redeploying development service...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Redeploy failed${NC}"
    exit 1
fi

# Get service URL
DEV_SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 DEVELOPMENT REDEPLOYED!${NC}"
echo ""
echo -e "${BLUE}📋 Development Environment:${NC}"
echo "🌐 DEV URL: $DEV_SERVICE_URL"
echo "🏷️  Environment: DEVELOPMENT"
echo "📍 Region: $REGION"
echo ""

# Test the updated deployment
echo -e "${BLUE}🧪 Testing updated development API...${NC}"
sleep 3

if curl -f -s "$DEV_SERVICE_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Development service updated and healthy!${NC}"
    echo "🌐 Health check: $DEV_SERVICE_URL/health"
    
    # Show health info
    echo -e "${BLUE}📊 Service health:${NC}"
    curl -s "$DEV_SERVICE_URL/health" | jq '.' 2>/dev/null || curl -s "$DEV_SERVICE_URL/health" | head -2
else
    echo -e "${YELLOW}⚠️  Development service starting up...${NC}"
    echo "🔄 Manual test: curl $DEV_SERVICE_URL/health"
fi

echo ""
echo -e "${GREEN}✅ Development environment updated! 🚧🚗${NC}"
echo ""
echo -e "${YELLOW}📝 Quick Tests:${NC}"
echo "• Health: curl $DEV_SERVICE_URL/health"
echo "• Root: curl $DEV_SERVICE_URL/"
echo ""
echo -e "${BLUE}🎯 Ready for development testing!${NC}"
