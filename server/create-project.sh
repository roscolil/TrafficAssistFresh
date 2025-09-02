#!/bin/bash

# Quick project creation and deployment script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Creating New Traffic Assist Project${NC}"
echo "======================================"

# Generate unique project ID
TIMESTAMP=$(date +%s)
PROJECT_ID="traffic-assist-${TIMESTAMP}"

echo -e "${BLUE}📋 Creating project: ${PROJECT_ID}${NC}"

# Create the project
if gcloud projects create $PROJECT_ID --name="Traffic Assist"; then
    echo -e "${GREEN}✅ Project created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create project${NC}"
    echo "Trying with a shorter name..."
    PROJECT_ID="ta-${TIMESTAMP}"
    gcloud projects create $PROJECT_ID --name="Traffic Assist"
fi

# Set as active project
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✅ Project set as active: ${PROJECT_ID}${NC}"

# Save project ID for deployment
echo "GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID}" > .env.deploy

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: You must enable billing for this project${NC}"
echo "1. Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
echo "2. Link a billing account to the project"
echo "3. Come back and run: ./deploy-backend.sh"

echo ""
echo -e "${BLUE}Or continue with local development:${NC}"
echo "./setup-local.sh && pnpm dev"

# Offer to open billing page
read -p "Open billing setup in browser? (y/n): " open_browser
if [[ $open_browser =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    else
        echo "Please open: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Project setup complete!${NC}"
echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Next: Enable billing, then run ./deploy-backend.sh${NC}"
