#!/bin/bash

# Traffic Assist - Billing Check and Fix Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}💳 Traffic Assist - Billing Check${NC}"
echo "=================================="

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No active project set${NC}"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${BLUE}🏷️  Current project: ${PROJECT_ID}${NC}"

# Check if project exists and you have access
if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
    echo -e "${RED}❌ Cannot access project ${PROJECT_ID}${NC}"
    echo "This could mean:"
    echo "1. Project doesn't exist"
    echo "2. You don't have access to the project"
    echo "3. Project ID is incorrect"
    exit 1
fi

echo -e "${GREEN}✅ Project access confirmed${NC}"

# Check billing status
echo -e "${BLUE}💰 Checking billing status...${NC}"
BILLING_ACCOUNT=$(gcloud billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING_ACCOUNT" ]; then
    echo -e "${RED}❌ Billing is NOT enabled${NC}"
    echo ""
    echo -e "${YELLOW}Available billing accounts:${NC}"
    gcloud billing accounts list --format="table(name,displayName,open)" 2>/dev/null || {
        echo -e "${RED}❌ No billing accounts found or no access${NC}"
        echo "You need to:"
        echo "1. Set up a billing account at: https://console.cloud.google.com/billing"
        echo "2. Add a payment method"
        exit 1
    }
    
    echo ""
    echo -e "${YELLOW}To fix this:${NC}"
    echo "1. 🌐 Open browser: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    echo "2. 💳 Link a billing account to your project"
    echo "3. ✅ Verify it's working by running this script again"
    echo ""
    echo -e "${BLUE}Or use CLI:${NC}"
    echo "gcloud billing projects link ${PROJECT_ID} --billing-account=BILLING_ACCOUNT_ID"
    echo ""
    
    # Offer to open the browser
    read -p "Open billing setup in browser? (y/n): " open_browser
    if [[ $open_browser =~ ^[Yy]$ ]]; then
        if command -v open &> /dev/null; then
            open "https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
        else
            echo "Please open: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
        fi
    fi
    
    exit 1
else
    echo -e "${GREEN}✅ Billing is enabled${NC}"
    echo -e "${BLUE}   Account: ${BILLING_ACCOUNT}${NC}"
fi

# Test API access by checking enabled services
echo -e "${BLUE}🔍 Testing API access...${NC}"

# Check if we can list services (this requires billing)
if gcloud services list --enabled --limit=1 &> /dev/null; then
    echo -e "${GREEN}✅ API access working${NC}"
else
    echo -e "${RED}❌ API access failed${NC}"
    echo "This suggests billing might not be properly configured."
    exit 1
fi

# Check specific APIs we need
echo -e "${BLUE}📋 Checking required APIs...${NC}"

REQUIRED_APIS=(
    "cloudsql.googleapis.com:Cloud SQL"
    "run.googleapis.com:Cloud Run"
    "pubsub.googleapis.com:Pub/Sub"
    "storage.googleapis.com:Cloud Storage"
    "cloudbuild.googleapis.com:Cloud Build"
    "secretmanager.googleapis.com:Secret Manager"
)

ALL_ENABLED=true

for api_info in "${REQUIRED_APIS[@]}"; do
    IFS=':' read -r api_name api_display <<< "$api_info"
    
    if gcloud services list --enabled --filter="name:${api_name}" --format="value(name)" | grep -q "$api_name"; then
        echo -e "${GREEN}  ✅ ${api_display} (${api_name})${NC}"
    else
        echo -e "${YELLOW}  ⚠️  ${api_display} (${api_name}) - Not enabled${NC}"
        ALL_ENABLED=false
    fi
done

if [ "$ALL_ENABLED" = true ]; then
    echo -e "${GREEN}🎉 All required APIs are enabled!${NC}"
    echo -e "${GREEN}✅ Ready for deployment${NC}"
else
    echo ""
    echo -e "${YELLOW}Some APIs need to be enabled. Run deployment script to enable them.${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. If billing is enabled: run ./deploy-backend.sh"
echo "2. If billing issues: visit the console link above"
echo "3. Check project quotas: https://console.cloud.google.com/iam-admin/quotas?project=${PROJECT_ID}"

echo ""
echo -e "${BLUE}Current project info:${NC}"
gcloud projects describe $PROJECT_ID --format="table(projectId,name,projectNumber,lifecycleState)"
