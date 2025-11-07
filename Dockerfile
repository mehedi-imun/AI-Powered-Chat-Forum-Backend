# -------------------
# Build Stage
# -------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy all source code
COPY . .

# Build the project (TypeScript, Next.js, or other build step)
RUN npm run build

# -------------------
# Production Stage
# -------------------
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set environment variables
ENV NODE_ENV=production
ARG PORT=5000
ENV PORT=$PORT

# Copy package.json and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create logs folder and assign ownership
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE $PORT

# Healthcheck for AWS ECS or other orchestrators
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
    CMD node -e "require('http').get('http://localhost:${PORT}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "dist/server.js"]
