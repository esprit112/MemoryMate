# Multi-stage build for MemoryMate
# Stage 1: Build the React frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (like sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Accept API_KEY as build argument to bake into frontend
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Build the frontend
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
# Copy server and necessary files
COPY server.js ./

# Create data directory (this will be the mount point)
RUN mkdir -p /data

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

EXPOSE 3000

CMD ["node", "server.js"]
