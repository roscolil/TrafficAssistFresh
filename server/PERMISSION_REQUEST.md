# Request Admin Access for TrueSignal Project

## Current Issue

User `ross.lillis@gmail.com` does not have sufficient permissions to enable Google Cloud APIs on project `truesignal`.

## Required Permissions

To deploy the Traffic Assist backend, the user needs one of these roles:

### Option 1: Project Owner (Recommended)

```bash
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/owner"
```

### Option 2: Specific Service Permissions

```bash
# Service Usage Admin (to enable APIs)
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/serviceusage.serviceUsageAdmin"

# Cloud SQL Admin
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/cloudsql.admin"

# Cloud Run Admin
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/run.admin"

# Pub/Sub Admin
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/pubsub.admin"

# Storage Admin
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/storage.admin"

# Secret Manager Admin
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/secretmanager.admin"

# Cloud Build Editor
gcloud projects add-iam-policy-binding truesignal \
    --member="user:ross.lillis@gmail.com" \
    --role="roles/cloudbuild.builds.editor"
```

## Alternative: Use Service Account

Create a service account with the necessary permissions and use it for deployment:

```bash
# Create service account (run by project owner)
gcloud iam service-accounts create traffic-assist-deployer \
    --display-name="Traffic Assist Deployer"

# Grant necessary roles
gcloud projects add-iam-policy-binding truesignal \
    --member="serviceAccount:traffic-assist-deployer@truesignal.iam.gserviceaccount.com" \
    --role="roles/editor"

# Create and download key
gcloud iam service-accounts keys create traffic-assist-key.json \
    --iam-account=traffic-assist-deployer@truesignal.iam.gserviceaccount.com

# User activates service account
gcloud auth activate-service-account --key-file=traffic-assist-key.json
```

## Quick Check Commands

```bash
# Check current permissions
gcloud projects get-iam-policy truesignal \
    --flatten="bindings[].members" \
    --filter="bindings.members:ross.lillis@gmail.com" \
    --format="table(bindings.role)"

# Test API enablement
gcloud services enable compute.googleapis.com
```
