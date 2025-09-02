#!/bin/bash

# Deploy Traffic Assist Backend Infrastructure

set -e

echo "🚀 Deploying Traffic Assist Backend Infrastructure..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK first."
    exit 1
fi

# Set project ID
PROJECT_ID=${1:-"traffic-assist-project"}
REGION=${2:-"us-central1"}

echo "📋 Using Project: $PROJECT_ID"
echo "📍 Using Region: $REGION"

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling Google Cloud APIs..."
gcloud services enable run.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable pubsub.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage-component.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Create Cloud SQL instance
echo "🗄️ Creating Cloud SQL database..."
gcloud sql instances create traffic-assist-db \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=$REGION \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --storage-auto-increase || echo "Database instance may already exist"

# Create database and user
echo "👤 Setting up database user and schema..."
gcloud sql databases create traffic_assist \
    --instance=traffic-assist-db || echo "Database may already exist"

gcloud sql users create app_user \
    --instance=traffic-assist-db \
    --password=secure_password_$(date +%s) || echo "User may already exist"

# Create Pub/Sub topics
echo "📡 Creating Pub/Sub topics..."
gcloud pubsub topics create traffic-events || echo "Topic may already exist"
gcloud pubsub topics create user-notifications || echo "Topic may already exist"
gcloud pubsub topics create ai-processing || echo "Topic may already exist"

# Create Cloud Storage buckets
echo "🪣 Creating Cloud Storage buckets..."
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-models || echo "Bucket may already exist"
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-media || echo "Bucket may already exist"

# Set bucket permissions
gsutil iam ch allUsers:objectViewer gs://$PROJECT_ID-models
gsutil iam ch allUsers:objectViewer gs://$PROJECT_ID-media

# Create service account for the application
echo "🔑 Creating service account..."
gcloud iam service-accounts create traffic-assist-service \
    --display-name="Traffic Assist Service Account" || echo "Service account may already exist"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:traffic-assist-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:traffic-assist-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/pubsub.publisher"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:traffic-assist-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

# Build and deploy web app
echo "🌐 Building and deploying web application..."
npm run web:build

# Deploy to App Engine
gcloud app deploy app.yaml --quiet

# Get Cloud SQL connection name
SQL_CONNECTION=$(gcloud sql instances describe traffic-assist-db --format="value(connectionName)")

echo "✅ Backend infrastructure deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with the following:"
echo "   DATABASE_URL=postgresql://app_user:YOUR_PASSWORD@/$PROJECT_ID:$REGION:traffic-assist-db/traffic_assist"
echo "   REACT_APP_API_URL=https://YOUR_API_SERVICE_URL"
echo "   REACT_APP_WS_URL=wss://YOUR_WS_SERVICE_URL"
echo ""
echo "2. Deploy your API services:"
echo "   docker build -t gcr.io/$PROJECT_ID/traffic-assist-api ./server"
echo "   docker push gcr.io/$PROJECT_ID/traffic-assist-api"
echo "   gcloud run deploy traffic-assist-api --image gcr.io/$PROJECT_ID/traffic-assist-api"
echo ""
echo "3. Set up monitoring and alerts in Google Cloud Console"
echo ""
echo "🎉 Your Traffic Assist backend is ready!"
