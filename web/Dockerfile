# Build stage
FROM node:20-bookworm AS builder

WORKDIR /app

# Install build dependencies that some native modules require
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Ensure npm runs postinstall scripts with proper permissions
ENV npm_config_unsafe_perm=true
# Force LightningCSS to use WASM transformer fallback when available to avoid native .node binary issues
ENV CSS_TRANSFORMER_WASM=1

# Install dependencies (deterministic)
# Use npm ci now that package-lock.json includes the platform package
RUN npm ci --no-audit --prefer-offline --no-fund --legacy-peer-deps

# Rebuild native binaries for lightningcss if needed (prevents missing platform binary)
RUN npm rebuild lightningcss --update-binary || true
RUN npm rebuild @swc/core --update-binary || true
# Diagnostic: list lightningcss and swc files so build logs show what exists
RUN ls -la node_modules/lightningcss || true
RUN ls -la node_modules/lightningcss/node || true
RUN find node_modules/lightningcss -type f -name '*.node' -exec ls -la {} \; || true
RUN sed -n '1,240p' node_modules/lightningcss/node/index.js || true
RUN ls -la node_modules/@swc || true
# Diagnostic: print Node platform/arch/version
RUN node -e "console.log('platform', process.platform, 'arch', process.arch, 'node', process.versions.node)" || true

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-bullseye-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
