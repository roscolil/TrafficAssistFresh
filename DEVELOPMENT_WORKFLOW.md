# Development Workflow Guide

## 🚧 Development Environment Setup Complete!

You now have a complete development deployment workflow set up for your Traffic Assist application.

## 📋 What's Been Implemented

### 1. **Development Branch Structure**

- **`main`** branch → Production deployments
- **`development`** branch → Development environment deployments
- **Feature branches** → Deploy to development for testing

### 2. **Deployment Scripts**

- **`deploy.sh`** - Smart deployment script that detects your branch and deploys to the appropriate environment
- **`server/deploy-dev.sh`** - Development environment deployment
- **`server/deploy-final.sh`** - Production environment deployment

### 3. **Separate Environments**

- **Production**: `traffic-assist-api` → https://traffic-assist-api-axoirfzmzq-uc.a.run.app
- **Development**: `traffic-assist-api-dev` → https://traffic-assist-api-dev-axoirfzmzq-uc.a.run.app

## 🔄 Development Workflow

### For Day-to-Day Development:

1. **Switch to development branch:**

   ```bash
   git checkout development
   ```

2. **Make your changes and commit:**

   ```bash
   git add .
   git commit -m "Your changes"
   ```

3. **Deploy to development environment:**

   ```bash
   ./deploy.sh
   ```

   _(The script will automatically detect you're on development branch)_

4. **Test your changes at the dev URL**

5. **When ready for production, merge to main:**
   ```bash
   git checkout main
   git merge development
   ./deploy.sh  # Deploys to production
   ```

### For Feature Development:

1. **Create a feature branch:**

   ```bash
   git checkout development
   git checkout -b feature/your-feature-name
   ```

2. **Develop and test:**

   ```bash
   # Make changes
   git add .
   git commit -m "Feature changes"
   ./deploy.sh  # Choose option 1 (Development)
   ```

3. **Merge back to development:**
   ```bash
   git checkout development
   git merge feature/your-feature-name
   ./deploy.sh  # Updates dev environment
   ```

## 🌐 Environment Configuration

### Development Environment Features:

- **Separate Cloud Run service**: `traffic-assist-api-dev`
- **Separate secrets**: `database-url-dev`, `api-key-dev`, `jwt-secret-dev`
- **Separate storage bucket**: `traffic-assist-1756794779-dev-uploads`
- **Debug logging enabled**
- **Lower resource limits** (cost optimization)

### Frontend Configuration:

- **Automatic environment detection**
- **Development API URL**: Auto-configured in development mode
- **Production API URL**: Used when on main branch

## 🧪 Testing Your Development Environment

To test the development deployment manually:

```bash
cd server
./deploy-dev.sh
```

This will:

1. Build a development Docker image
2. Create/update development secrets
3. Deploy to `traffic-assist-api-dev` service
4. Create development storage bucket
5. Test the deployment
6. Update frontend configuration

## 📱 Frontend Development

The frontend automatically detects the environment:

- **Local development**: Uses `localhost:3001`
- **Development deployment**: Uses development Cloud Run URL
- **Production**: Uses production Cloud Run URL

## 📊 Environment Status

### ✅ Production (Ready)

- URL: https://traffic-assist-api-axoirfzmzq-uc.a.run.app
- Database: Connected to Neon PostgreSQL
- Status: Healthy and operational

### 🚧 Development (Ready to Deploy)

- URL: Will be `https://traffic-assist-api-dev-axoirfzmzq-uc.a.run.app`
- Database: Can use shared or separate dev database
- Status: Ready for first deployment

## 🎯 Next Steps

1. **Run your first development deployment:**

   ```bash
   git checkout development
   ./deploy.sh
   ```

2. **Test the development API**

3. **Start developing new features** with confidence knowing you have separate dev/prod environments

4. **Use the development environment** for testing before production releases

## 🔧 Configuration Files

- **`.env.development`** - Created after dev deployment
- **`.env.production`** - Production configuration
- **`src/backend/config.ts`** - Smart environment detection
- **`src/backend/config.development.ts`** - Development overrides

## 🎉 You're All Set!

Your Traffic Assist application now has:

- ✅ Production environment deployed and working
- ✅ Development deployment workflow ready
- ✅ Smart deployment scripts
- ✅ Separate environments for dev/prod
- ✅ Automatic frontend configuration
- ✅ Git-based workflow for releases

Ready to develop with confidence! 🚗💨
