# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy frontend source and build it
COPY web/frontend ./web/frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY web/backend ./web/backend

# Copy built frontend from builder stage
COPY --from=builder /app/web/frontend/dist ./web/frontend/dist

# Copy app config
COPY shopify.app.toml ./

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "web/backend/server.js"]
