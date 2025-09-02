#!/bin/bash

# Quick fix for development deployment
set -e

echo "🔧 Quick Development Fix"
echo "======================="

# Build with timestamp tag
TIMESTAMP=$(date +%s)
IMAGE_TAG="gcr.io/traffic-assist-1756794779/traffic-assist-api-dev:fix-$TIMESTAMP"

echo "🐳 Building image: $IMAGE_TAG"
gcloud builds submit --tag $IMAGE_TAG . --timeout=600

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    
    echo "🚀 Deploying to development service..."
    gcloud run deploy traffic-assist-api-dev \
        --image $IMAGE_TAG \
        --region us-central1 \
        --allow-unauthenticated \
        --set-env-vars "NODE_ENV=development" \
        --set-env-vars "GOOGLE_CLOUD_PROJECT=traffic-assist-1756794779"
    
    if [ $? -eq 0 ]; then
        echo "✅ Deployment successful"
        echo "🧪 Testing..."
        sleep 5
        curl https://traffic-assist-api-dev-axoirfzmzq-uc.a.run.app/
    else
        echo "❌ Deployment failed"
    fi
else
    echo "❌ Build failed"
fi
