#!/bin/bash

# Traffic Assist Backend Deployment Script
# This script deploys the complete backend infrastructure to Google Cloud Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"traffic-assist-$(date +%s)"}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
SERVICE_NAME="traffic-assist-api"
DATABASE_INSTANCE="traffic-assist-db"
DATABASE_NAME="traffic_assist"
DATABASE_USER="traffic_assist_user"

echo -e "${BLUE}🚀 Starting Traffic Assist Backend Deployment${NC}"
echo "=================================================="

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud SDK not found. Please install it first.${NC}"
    exit 1
fi

# Check if logged in to gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  Not logged in to Google Cloud. Please run 'gcloud auth login'${NC}"
    exit 1
fi

# Get the current user account
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)
echo -e "${BLUE}👤 Authenticated as: ${ACCOUNT}${NC}"

# Check if project exists, if not create it
echo -e "${BLUE}📋 Checking Google Cloud project: ${PROJECT_ID}${NC}"
if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
    echo -e "${YELLOW}⚠️  Project '${PROJECT_ID}' doesn't exist. Creating it...${NC}"
    
    # Create the project
    gcloud projects create $PROJECT_ID --name="Traffic Assist"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Project created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create project. Trying with a unique name...${NC}"
        PROJECT_ID="traffic-assist-$(openssl rand -hex 4)"
        echo -e "${BLUE}🔄 Trying with project ID: ${PROJECT_ID}${NC}"
        gcloud projects create $PROJECT_ID --name="Traffic Assist"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to create project. Please create a project manually and set GOOGLE_CLOUD_PROJECT_ID environment variable.${NC}"
            exit 1
        fi
    fi
    
    echo -e "${YELLOW}⚠️  New project created. You may need to enable billing for this project.${NC}"
    echo -e "${YELLOW}   Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}${NC}"
    read -p "Press Enter after enabling billing to continue..."
else
    echo -e "${GREEN}✅ Project exists${NC}"
fi

# Set the project
gcloud config set project $PROJECT_ID

# Check if billing is enabled
echo -e "${BLUE}💳 Checking billing status...${NC}"
BILLING_ACCOUNT=$(gcloud billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>/dev/null || echo "")
if [ -z "$BILLING_ACCOUNT" ]; then
    echo -e "${RED}❌ Billing is not enabled for this project.${NC}"
    echo -e "${YELLOW}   This is required to use Google Cloud APIs.${NC}"
    echo ""
    echo -e "${BLUE}Available billing accounts:${NC}"
    gcloud billing accounts list --format="table(name,displayName,open)" 2>/dev/null || echo "No billing accounts found"
    echo ""
    echo -e "${YELLOW}To enable billing:${NC}"
    echo "1. Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    echo "2. Or run: gcloud billing projects link ${PROJECT_ID} --billing-account=BILLING_ACCOUNT_ID"
    echo ""
    echo -e "${RED}Deployment cannot continue without billing enabled.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Billing is enabled (${BILLING_ACCOUNT})${NC}"
fi

# Verify billing is working by checking quota
echo -e "${BLUE}🔍 Verifying API access...${NC}"
if ! gcloud services list --enabled --filter="name:compute.googleapis.com" --format="value(name)" | grep -q compute; then
    echo -e "${YELLOW}⚠️  Compute Engine API not enabled. This suggests billing issues.${NC}"
    echo -e "${YELLOW}   Please check billing status in the console.${NC}"
    read -p "Press Enter after verifying billing to continue..."
fi

# Enable required APIs with better error handling
echo -e "${BLUE}🔌 Enabling required Google Cloud APIs...${NC}"

APIs=(
    "cloudsql.googleapis.com"
    "run.googleapis.com" 
    "pubsub.googleapis.com"
    "storage.googleapis.com"
    "cloudbuild.googleapis.com"
    "secretmanager.googleapis.com"
    "compute.googleapis.com"
)

for api in "${APIs[@]}"; do
    echo -e "${BLUE}  Enabling ${api}...${NC}"
    if gcloud services enable $api; then
        echo -e "${GREEN}  ✅ ${api} enabled${NC}"
    else
        echo -e "${RED}  ❌ Failed to enable ${api}${NC}"
        echo -e "${YELLOW}     This usually means billing is not properly configured.${NC}"
        echo -e "${YELLOW}     Please check: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}${NC}"
        exit 1
    fi
    sleep 2  # Small delay to avoid rate limiting
done

echo -e "${GREEN}✅ All APIs enabled successfully${NC}"

# Create Cloud SQL instance if it doesn't exist
echo -e "${BLUE}💾 Setting up Cloud SQL PostgreSQL instance...${NC}"
if ! gcloud sql instances describe $DATABASE_INSTANCE &> /dev/null; then
    echo "Creating Cloud SQL instance..."
    gcloud sql instances create $DATABASE_INSTANCE \
        --database-version=POSTGRES_15 \
        --cpu=2 \
        --memory=7680MB \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=20GB \
        --storage-auto-increase \
        --backup-start-time=02:00 \
        --enable-bin-log \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=02 \
        --deletion-protection
    
    echo "Waiting for instance to be ready..."
    gcloud sql instances patch $DATABASE_INSTANCE --no-deletion-protection
else
    echo "Cloud SQL instance already exists."
fi

# Set up database user
echo -e "${BLUE}👤 Setting up database user...${NC}"
if ! gcloud sql users describe $DATABASE_USER --instance=$DATABASE_INSTANCE &> /dev/null; then
    # Generate secure password
    DB_PASSWORD=$(openssl rand -base64 32)
    
    gcloud sql users create $DATABASE_USER \
        --instance=$DATABASE_INSTANCE \
        --password=$DB_PASSWORD
    
    echo -e "${GREEN}✅ Database user created with password: ${DB_PASSWORD}${NC}"
    echo -e "${YELLOW}⚠️  Please save this password securely!${NC}"
else
    echo "Database user already exists."
    echo -e "${YELLOW}⚠️  Please ensure you have the database password.${NC}"
    read -s -p "Enter database password: " DB_PASSWORD
    echo
fi

# Create database
echo -e "${BLUE}🗄️  Creating database...${NC}"
if ! gcloud sql databases describe $DATABASE_NAME --instance=$DATABASE_INSTANCE &> /dev/null; then
    gcloud sql databases create $DATABASE_NAME --instance=$DATABASE_INSTANCE
    echo "Database created."
else
    echo "Database already exists."
fi

# Get database connection name
DB_CONNECTION_NAME=$(gcloud sql instances describe $DATABASE_INSTANCE --format="value(connectionName)")

# Create Pub/Sub topics
echo -e "${BLUE}📨 Setting up Pub/Sub topics...${NC}"
for topic in traffic-events traffic-updates alerts; do
    if ! gcloud pubsub topics describe $topic &> /dev/null; then
        gcloud pubsub topics create $topic
        echo "Created topic: $topic"
    else
        echo "Topic already exists: $topic"
    fi
done

# Create Cloud Storage buckets
echo -e "${BLUE}🪣 Setting up Cloud Storage buckets...${NC}"
for bucket in "${PROJECT_ID}-traffic-data" "${PROJECT_ID}-models"; do
    if ! gsutil ls "gs://$bucket" &> /dev/null; then
        gsutil mb -l $REGION "gs://$bucket"
        echo "Created bucket: $bucket"
    else
        echo "Bucket already exists: $bucket"
    fi
done

# Store secrets in Secret Manager
echo -e "${BLUE}🔐 Storing secrets in Secret Manager...${NC}"
echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=- || \
echo -n "$DB_PASSWORD" | gcloud secrets versions add db-password --data-file=-

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 64)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

# Build and deploy the application
echo -e "${BLUE}🏗️  Building and deploying the application...${NC}"

# Create Dockerfile if it doesn't exist
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
EOF

# Create .dockerignore
cat > .dockerignore << EOF
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.example
coverage
.nyc_output
dist
EOF

# Build and submit to Cloud Build
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --max-instances 100 \
    --set-env-vars "NODE_ENV=production" \
    --set-env-vars "PORT=8080" \
    --set-env-vars "GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID" \
    --set-env-vars "CLOUD_SQL_CONNECTION_NAME=$DB_CONNECTION_NAME" \
    --set-env-vars "DB_NAME=$DATABASE_NAME" \
    --set-env-vars "DB_USER=$DATABASE_USER" \
    --set-secrets "DB_PASSWORD=db-password:latest" \
    --set-secrets "JWT_SECRET=jwt-secret:latest" \
    --add-cloudsql-instances $DB_CONNECTION_NAME

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "=================================================="
echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}"
echo -e "${GREEN}Database Instance: ${DATABASE_INSTANCE}${NC}"
echo -e "${GREEN}Database Connection: ${DB_CONNECTION_NAME}${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Initialize the database schema:"
echo "   gcloud sql connect $DATABASE_INSTANCE --user=$DATABASE_USER --database=$DATABASE_NAME"
echo "   Then run the SQL from src/db/init.sql"
echo ""
echo "2. Test your API:"
echo "   curl ${SERVICE_URL}/health"
echo ""
echo "3. Update your frontend configuration to use:"
echo "   REACT_APP_API_URL=${SERVICE_URL}"
echo ""
echo -e "${YELLOW}⚠️  Important: Save the database password and connection details securely!${NC}"
