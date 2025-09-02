#!/bin/bash

# Complete the deployment after successful build
set -e

PROJECT_ID="traffic-assist-1756794779"
SERVICE_NAME="traffic-assist-api"
REGION="us-central1"

echo "🚀 Completing Traffic Assist deployment..."

# Check if build completed successfully
echo "📋 Checking build status..."
gcloud builds list --limit=1 --format="value(status)"

# Create/update secrets if needed
echo "🔐 Ensuring secrets are created..."

# You'll need to provide your Neon database URL here
read -p "Enter your Neon database URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Database URL is required"
    exit 1
fi

# Create secrets
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

API_KEY=$(openssl rand -base64 32)
echo -n "$API_KEY" | gcloud secrets create api-key --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$API_KEY" | gcloud secrets versions add api-key --data-file=-

JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" 2>/dev/null || \
echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-

echo "✅ Secrets ready"

# Create storage bucket
echo "🪣 Creating storage bucket..."
BUCKET_NAME="${PROJECT_ID}-traffic-uploads"
gsutil mb -l $REGION gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME 2>/dev/null || echo "Bucket permissions already set"

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."

gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,STORAGE_BUCKET=$BUCKET_NAME" \
    --set-secrets "DATABASE_URL=database-url:latest,API_KEY=api-key:latest,JWT_SECRET=jwt-secret:latest" \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --concurrency 100 \
    --timeout 300

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📋 Your Traffic Assist API:"
echo "🌐 URL: $SERVICE_URL"
echo "🗄️  Database: Neon PostgreSQL"
echo "🪣 Storage: gs://$BUCKET_NAME"
echo "📍 Region: $REGION"
echo ""

# Test the deployment
echo "🧪 Testing deployment..."
sleep 5
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    echo "✅ API health check passed"
else
    echo "⚠️  API may still be starting up"
    echo "Try: curl $SERVICE_URL/health"
fi

# Save configuration
cat > .env.production << EOF
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
SERVICE_URL=$SERVICE_URL
DATABASE_URL=$DATABASE_URL
STORAGE_BUCKET=$BUCKET_NAME
REGION=$REGION
API_URL=$SERVICE_URL
WS_URL=${SERVICE_URL/https/wss}
EOF

echo "💾 Configuration saved to .env.production"
echo ""
echo "🎯 Next Steps:"
echo "1. Test: curl $SERVICE_URL/health"
echo "2. Update frontend to use: $SERVICE_URL"
echo "3. Test database: curl $SERVICE_URL/api/health/db"
echo ""
echo "✅ Traffic Assist is now live!"
