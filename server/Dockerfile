# Multi-stage build for better reliability
FROM node:18-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and all dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and production dependencies only
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]
