# Traffic Assist Backend API

A comprehensive backend infrastructure for the Traffic Assist application, providing real-time traffic light detection, analytics, and user management capabilities.

## 🚀 Features

- **Real-time Traffic Detection**: Process and analyze traffic light detections from mobile devices
- **Geospatial Analytics**: PostGIS-powered location-based queries and spatial analysis
- **WebSocket Support**: Real-time communication for live traffic updates
- **Pub/Sub Integration**: Scalable event processing with Google Cloud Pub/Sub
- **User Management**: Device registration, user profiles, and preferences
- **Analytics Dashboard**: Comprehensive traffic patterns and performance metrics
- **Cloud-Native**: Designed for Google Cloud Platform with Cloud Run deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │   Web App       │    │   Admin Panel   │
│   (iOS/Android) │    │   (PWA)         │    │   (Analytics)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Express.js API       │
                    │   (Cloud Run Service)    │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
    ┌─────▼─────┐         ┌──────▼──────┐        ┌─────▼─────┐
    │ Cloud SQL │         │   Pub/Sub   │        │  Storage  │
    │(PostgreSQL│         │  (Events)   │        │ (Models)  │
    │ + PostGIS)│         │             │        │           │
    └───────────┘         └─────────────┘        └───────────┘
```

## 📋 Prerequisites

### For Local Development

- Node.js 18+
- PostgreSQL 15+ with PostGIS extension
- pnpm (recommended) or npm

### For Production Deployment

- Google Cloud SDK
- Docker (for containerization)
- Google Cloud Project with billing enabled

## 🛠️ Quick Start

### Local Development Setup

1. **Clone and navigate to the server directory:**

   ```bash
   cd server
   ```

2. **Run the automated setup script:**

   ```bash
   ./setup-local.sh
   ```

   This script will:

   - Install PostgreSQL and PostGIS (if not present)
   - Create local database and user
   - Initialize database schema
   - Install dependencies
   - Create local environment configuration

3. **Start the development server:**
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3001`

### Manual Local Setup

If you prefer manual setup:

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up PostgreSQL database:**

   ```bash
   createdb traffic_assist_dev
   psql traffic_assist_dev -f src/db/init.sql
   ```

3. **Create environment file:**

   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Build and start:**
   ```bash
   pnpm build
   pnpm dev
   ```

## 🌐 Production Deployment

### Automated Cloud Deployment

1. **Ensure you're logged in to Google Cloud:**

   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Run the deployment script:**
   ```bash
   ./deploy-backend.sh
   ```

This will automatically:

- Enable required Google Cloud APIs
- Create Cloud SQL PostgreSQL instance with PostGIS
- Set up Pub/Sub topics for event processing
- Create Cloud Storage buckets
- Deploy the application to Cloud Run
- Configure secrets and environment variables

### Manual Cloud Deployment

For custom deployment configurations, see the deployment script for reference and adjust as needed.

## 📊 API Endpoints

### Device Management

- `POST /api/devices/register` - Register a new device
- `GET /api/devices/:deviceId` - Get device information
- `PUT /api/devices/:deviceId` - Update device settings

### Traffic Detections

- `POST /api/detections` - Submit traffic detection
- `GET /api/detections/device/:deviceId` - Get device detections
- `POST /api/detections/:detectionId/confirm` - Confirm detection

### Traffic Data

- `GET /api/traffic/area` - Get traffic data for area
- `GET /api/traffic/patterns` - Get traffic patterns
- `POST /api/traffic/update` - Update traffic state
- `GET /api/traffic/heatmap` - Get traffic density heatmap

### User Management

- `POST /api/users/register` - Register/login user
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId/preferences` - Update preferences
- `GET /api/users/:userId/stats` - Get user statistics

### Analytics

- `GET /api/analytics/overview` - Get analytics overview
- `GET /api/analytics/performance` - Get performance metrics
- `GET /api/analytics/geography` - Get geographical analytics
- `GET /api/analytics/realtime` - Get real-time metrics

### System

- `GET /health` - Health check endpoint
- `GET /api/status` - Detailed system status

## 🗄️ Database Schema

The application uses PostgreSQL with PostGIS for geospatial capabilities:

- **devices**: Device registration and configuration
- **users**: User accounts and preferences
- **detections**: Traffic light detection records with spatial data
- **traffic**: Aggregated traffic state information
- **alerts**: System alerts and notifications

See `src/db/init.sql` for the complete schema definition.

## 🔧 Configuration

### Environment Variables

Key configuration options (see `.env.example` for complete list):

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_CLOUD_PROJECT_ID`: GCP project ID
- `JWT_SECRET`: Secret for token signing
- `CORS_ORIGIN`: Allowed CORS origins

### Database Configuration

- **Connection Pool**: Configurable pool size and timeouts
- **SSL**: Enabled automatically for Cloud SQL connections
- **Spatial Support**: PostGIS extension for location queries

## 📈 Performance

### Optimizations

- Database connection pooling
- Spatial indexing for location queries
- WebSocket connection management
- Rate limiting for API endpoints
- Pub/Sub for asynchronous processing

### Monitoring

- Health check endpoints
- Real-time metrics collection
- Performance analytics
- Error tracking and logging

## 🔒 Security

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- SQL injection prevention
- Secure secret management with Cloud Secret Manager

## 🧪 Development

### Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build TypeScript to JavaScript
- `pnpm start` - Start production server
- `pnpm setup` - Run local setup script
- `pnpm deploy` - Deploy to production
- `pnpm db:init` - Initialize database schema
- `pnpm db:reset` - Reset local database
- `pnpm type-check` - Check TypeScript types

### Development Tools

- **TypeScript**: Type safety and modern JavaScript features
- **ts-node**: Direct TypeScript execution for development
- **Hot Reload**: Automatic server restart on file changes
- **Database Tools**: Scripts for schema management

## 📝 API Documentation

### Authentication

Currently using device-based authentication. Each device registers with a unique ID and receives API access.

### Rate Limiting

- 100 requests per 15 minutes per IP (default)
- Configurable limits for different endpoints
- Bypassed for development environment

### Error Handling

Standardized error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### WebSocket Events

- `traffic_alert` - Real-time traffic notifications
- `detection_update` - Detection confirmations
- `system_status` - System health updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section below
2. Review the logs: `pnpm dev` shows detailed logging
3. Check database connectivity: `psql -d traffic_assist_dev -U traffic_assist_user`

### Common Issues

**Database Connection Error:**

- Ensure PostgreSQL is running: `brew services start postgresql@15`
- Check database exists: `psql postgres -l`
- Verify user permissions

**PostGIS Extension Error:**

- Install PostGIS: `brew install postgis`
- Enable in database: `psql traffic_assist_dev -c "CREATE EXTENSION postgis;"`

**Port Already in Use:**

- Change PORT in `.env` file
- Kill existing process: `lsof -ti:3001 | xargs kill`

**Google Cloud Deployment Issues:**

- Verify authentication: `gcloud auth list`
- Check project access: `gcloud projects list`
- Ensure billing is enabled on the project
