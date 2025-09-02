#!/bin/bash

# Traffic Assist - Google Cloud Project Setup
# This script helps set up the initial Google Cloud project and requirements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏗️  Traffic Assist - Google Cloud Setup${NC}"
echo "============================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud SDK not found.${NC}"
    echo -e "${YELLOW}Please install it from: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Google Cloud SDK found${NC}"

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  Not logged in to Google Cloud.${NC}"
    echo -e "${BLUE}Starting authentication...${NC}"
    gcloud auth login
fi

ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)
echo -e "${GREEN}✅ Authenticated as: ${ACCOUNT}${NC}"

# Get available projects
echo -e "${BLUE}📋 Available projects:${NC}"
gcloud projects list --format="table(projectId,name,projectNumber)" || true

echo ""
echo -e "${BLUE}Options:${NC}"
echo "1. Create a new project"
echo "2. Use an existing project"
echo "3. Exit"

read -p "Choose an option (1-3): " choice

case $choice in
    1)
        echo -e "${BLUE}🆕 Creating a new project...${NC}"
        
        # Generate a unique project ID
        TIMESTAMP=$(date +%s)
        DEFAULT_PROJECT_ID="traffic-assist-${TIMESTAMP}"
        
        read -p "Enter project ID [$DEFAULT_PROJECT_ID]: " PROJECT_ID
        PROJECT_ID=${PROJECT_ID:-$DEFAULT_PROJECT_ID}
        
        read -p "Enter project name [Traffic Assist]: " PROJECT_NAME
        PROJECT_NAME=${PROJECT_NAME:-"Traffic Assist"}
        
        echo -e "${BLUE}Creating project: ${PROJECT_ID}${NC}"
        gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Project created successfully!${NC}"
        else
            echo -e "${RED}❌ Failed to create project. It might already exist or you don't have permissions.${NC}"
            exit 1
        fi
        ;;
    2)
        echo -e "${BLUE}📝 Using existing project...${NC}"
        read -p "Enter project ID: " PROJECT_ID
        
        if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
            echo -e "${RED}❌ Project not found or no access: ${PROJECT_ID}${NC}"
            exit 1
        fi
        ;;
    3)
        echo -e "${YELLOW}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

# Set the project as default
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✅ Project set as default: ${PROJECT_ID}${NC}"

# Check billing
echo -e "${BLUE}💳 Checking billing...${NC}"
BILLING_ACCOUNT=$(gcloud billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING_ACCOUNT" ]; then
    echo -e "${YELLOW}⚠️  Billing is not enabled for this project.${NC}"
    echo -e "${YELLOW}You need to enable billing to use Google Cloud services.${NC}"
    echo ""
    echo -e "${BLUE}Available billing accounts:${NC}"
    gcloud billing accounts list --format="table(name,displayName,open)" || true
    echo ""
    echo -e "${YELLOW}To enable billing:${NC}"
    echo "1. Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    echo "2. Or run: gcloud billing projects link ${PROJECT_ID} --billing-account=BILLING_ACCOUNT_ID"
    echo ""
    read -p "Press Enter after enabling billing to continue..."
else
    echo -e "${GREEN}✅ Billing is enabled${NC}"
fi

# Create environment file for deployment
echo -e "${BLUE}⚙️  Creating deployment configuration...${NC}"
cat > .env.deploy << EOF
# Google Cloud Configuration for Deployment
GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID}
GOOGLE_CLOUD_REGION=us-central1

# Generated on: $(date)
# Account: ${ACCOUNT}
EOF

echo -e "${GREEN}✅ Configuration saved to .env.deploy${NC}"

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo "================================"
echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Account: ${ACCOUNT}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Ensure billing is enabled (if not done already)"
echo "2. Run the deployment script: ./deploy-backend.sh"
echo ""
echo -e "${BLUE}Quick commands:${NC}"
echo "• Deploy backend: GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID} ./deploy-backend.sh"
echo "• View project: gcloud projects describe ${PROJECT_ID}"
echo "• Set project: gcloud config set project ${PROJECT_ID}"
