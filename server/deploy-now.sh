#!/bin/bash

# Quick deploy after successful build
set -e

PROJECT_ID="traffic-assist-1756794779"
SERVICE_NAME="traffic-assist-api"
REGION="us-central1"

echo "🚀 Deploying Traffic Assist API..."

# Check if image exists
echo "📋 Verifying container image..."
gcloud container images describe gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

if [ $? -eq 0 ]; then
    echo "✅ Container image found!"
else
    echo "❌ Container image not found. Build may have failed."
    exit 1
fi

# Get your database URL
read -p "Enter your Neon database URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Database URL is required"
    exit 1
fi

# Create secrets
echo "🔐 Creating secrets..."
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

API_KEY=$(openssl rand -base64 32)
echo -n "$API_KEY" | gcloud secrets create api-key --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$API_KEY" | gcloud secrets versions add api-key --data-file=-

JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --set-secrets "DATABASE_URL=database-url:latest,API_KEY=api-key:latest,JWT_SECRET=jwt-secret:latest" \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10

# Get URL and test
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo "🎉 Deployment complete!"
echo "🌐 API URL: $SERVICE_URL"
echo ""
echo "🧪 Testing..."
curl -f "$SERVICE_URL/health" && echo "✅ Health check passed!" || echo "⚠️ Health check failed"

echo ""
echo "🎯 Your Traffic Assist API is live at:"
echo "$SERVICE_URL"
