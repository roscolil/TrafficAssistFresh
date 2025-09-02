#!/bin/bash

# Traffic Assist - Admin Deployment Script
# Optimized for billing account administrators

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Traffic Assist - Admin Deployment${NC}"
echo "===================================="

# Check if we have a project from the creation script
if [ -f ".env.deploy" ]; then
    source .env.deploy
    echo -e "${BLUE}📋 Using project from .env.deploy: ${GOOGLE_CLOUD_PROJECT_ID}${NC}"
    PROJECT_ID=$GOOGLE_CLOUD_PROJECT_ID
else
    # Generate new project ID if not provided
    PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"traffic-assist-$(date +%s)"}
    echo -e "${BLUE}📋 Creating new project: ${PROJECT_ID}${NC}"
    
    # Create project
    gcloud projects create $PROJECT_ID --name="Traffic Assist Production"
    gcloud config set project $PROJECT_ID
    echo "GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID}" > .env.deploy
    GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
fi

# Set project as active
gcloud config set project $PROJECT_ID

echo -e "${GREEN}✅ Active project: ${PROJECT_ID}${NC}"

# As billing admin, automatically link billing
echo -e "${BLUE}💳 Setting up billing...${NC}"

# Get available billing accounts
BILLING_ACCOUNTS=$(gcloud billing accounts list --format="value(name)" --filter="open:true" | head -1)

if [ -n "$BILLING_ACCOUNTS" ]; then
    BILLING_ACCOUNT=$(echo $BILLING_ACCOUNTS | head -1)
    echo -e "${BLUE}💰 Linking billing account: ${BILLING_ACCOUNT}${NC}"
    
    gcloud billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Billing linked successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Manual billing link may be needed${NC}"
        echo "Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
        read -p "Press Enter after linking billing..."
    fi
else
    echo -e "${YELLOW}⚠️  No billing accounts found or need manual setup${NC}"
    echo "Visit: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
    read -p "Press Enter after setting up billing..."
fi

# Enable APIs in batches to avoid rate limiting
echo -e "${BLUE}🔌 Enabling Google Cloud APIs...${NC}"

# Core APIs first
echo -e "${BLUE}  Enabling core APIs...${NC}"
gcloud services enable \
    serviceusage.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    compute.googleapis.com

sleep 5

# Database and storage APIs
echo -e "${BLUE}  Enabling database and storage APIs...${NC}"
gcloud services enable \
    cloudsql.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com

sleep 5

# Application APIs
echo -e "${BLUE}  Enabling application APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    pubsub.googleapis.com \
    cloudbuild.googleapis.com

echo -e "${GREEN}✅ All APIs enabled${NC}"

# Configuration
REGION="us-central1"
SERVICE_NAME="traffic-assist-api"
DATABASE_INSTANCE="traffic-assist-db"
DATABASE_NAME="traffic_assist"
DATABASE_USER="traffic_assist_user"

# Create Cloud SQL instance
echo -e "${BLUE}💾 Creating Cloud SQL PostgreSQL instance...${NC}"
if ! gcloud sql instances describe $DATABASE_INSTANCE &> /dev/null; then
    echo "Creating Cloud SQL instance (this takes 5-10 minutes)..."
    
    gcloud sql instances create $DATABASE_INSTANCE \
        --database-version=POSTGRES_15 \
        --cpu=2 \
        --memory=7680MB \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=20GB \
        --storage-auto-increase \
        --backup-start-time=02:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=02 \
        --no-deletion-protection
        
    echo -e "${GREEN}✅ Cloud SQL instance created${NC}"
else
    echo -e "${GREEN}✅ Cloud SQL instance already exists${NC}"
fi

# Set up database user
echo -e "${BLUE}👤 Setting up database user...${NC}"
DB_PASSWORD=$(openssl rand -base64 32)

if ! gcloud sql users describe $DATABASE_USER --instance=$DATABASE_INSTANCE &> /dev/null; then
    gcloud sql users create $DATABASE_USER \
        --instance=$DATABASE_INSTANCE \
        --password=$DB_PASSWORD
    echo -e "${GREEN}✅ Database user created${NC}"
else
    echo -e "${YELLOW}⚠️  Database user already exists${NC}"
fi

# Create database
echo -e "${BLUE}🗄️  Creating database...${NC}"
if ! gcloud sql databases describe $DATABASE_NAME --instance=$DATABASE_INSTANCE &> /dev/null; then
    gcloud sql databases create $DATABASE_NAME --instance=$DATABASE_INSTANCE
    echo -e "${GREEN}✅ Database created${NC}"
else
    echo -e "${GREEN}✅ Database already exists${NC}"
fi

# Store secrets
echo -e "${BLUE}🔐 Storing secrets...${NC}"
echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=- --replication-policy="automatic" || \
echo -n "$DB_PASSWORD" | gcloud secrets versions add db-password --data-file=-

JWT_SECRET=$(openssl rand -base64 64)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

echo -e "${GREEN}✅ Secrets stored${NC}"

# Create Pub/Sub topics
echo -e "${BLUE}📨 Creating Pub/Sub topics...${NC}"
for topic in traffic-events traffic-updates alerts; do
    if ! gcloud pubsub topics describe $topic &> /dev/null; then
        gcloud pubsub topics create $topic
        echo -e "${GREEN}  ✅ Created topic: $topic${NC}"
    else
        echo -e "${GREEN}  ✅ Topic exists: $topic${NC}"
    fi
done

# Create Cloud Storage buckets
echo -e "${BLUE}🪣 Creating Cloud Storage buckets...${NC}"
for bucket in "${PROJECT_ID}-traffic-data" "${PROJECT_ID}-models"; do
    if ! gsutil ls "gs://$bucket" &> /dev/null; then
        gsutil mb -l $REGION "gs://$bucket"
        echo -e "${GREEN}  ✅ Created bucket: $bucket${NC}"
    else
        echo -e "${GREEN}  ✅ Bucket exists: $bucket${NC}"
    fi
done

# Build and deploy application
echo -e "${BLUE}🏗️  Building and deploying application...${NC}"

# Get database connection name
DB_CONNECTION_NAME=$(gcloud sql instances describe $DATABASE_INSTANCE --format="value(connectionName)")

# Create optimized Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Change ownership
RUN chown -R backend:nodejs /app
USER backend

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
EOF

# Build and deploy
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

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
    --min-instances 1 \
    --concurrency 1000 \
    --timeout 3600 \
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

# Initialize database schema
echo -e "${BLUE}📋 Initializing database schema...${NC}"
gcloud sql connect $DATABASE_INSTANCE --user=$DATABASE_USER --database=$DATABASE_NAME < src/db/init.sql || {
    echo -e "${YELLOW}⚠️  Manual database initialization required${NC}"
    echo "Run: gcloud sql connect $DATABASE_INSTANCE --user=$DATABASE_USER --database=$DATABASE_NAME"
    echo "Then paste the contents of src/db/init.sql"
}

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
echo "================================================="
echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
echo -e "${GREEN}🗄️  Database: ${DATABASE_INSTANCE}${NC}"
echo -e "${GREEN}🔗 Connection: ${DB_CONNECTION_NAME}${NC}"
echo -e "${GREEN}📋 Project: ${PROJECT_ID}${NC}"
echo ""
echo -e "${BLUE}🧪 Test your API:${NC}"
echo "curl ${SERVICE_URL}/health"
echo ""
echo -e "${BLUE}🔗 Update your frontend:${NC}"
echo "REACT_APP_API_URL=${SERVICE_URL}"
echo ""
echo -e "${BLUE}📊 Monitor your deployment:${NC}"
echo "https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}"
echo ""
echo -e "${GREEN}✅ Your Traffic Assist backend is now live!${NC}"
