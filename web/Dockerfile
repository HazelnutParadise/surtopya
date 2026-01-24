# Build stage
FROM oven/bun:1.3-slim AS builder

WORKDIR /app

# Install build dependencies that some native modules require
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Ensure npm runs postinstall scripts with proper permissions
ENV npm_config_unsafe_perm=true


# Install dependencies (deterministic)
RUN bun install --no-audit --prefer-offline --no-fund --legacy-peer-deps

# Rebuild native binaries for lightningcss if needed (prevents missing platform binary)
RUN bun rebuild lightningcss --update-binary || true
RUN bun rebuild @swc/core --update-binary || true
# Ensure tailwind oxide binary installed for linux x64 gnu (fixes missing native binding during PostCSS)
RUN bun rebuild @tailwindcss/oxide-linux-x64-gnu --update-binary || true
# Diagnostic: list lightningcss, swc and tailwind oxide files so build logs show what exists
RUN ls -la node_modules/lightningcss || true
RUN ls -la node_modules/lightningcss/node || true
RUN find node_modules/lightningcss -type f -name '*.node' -exec ls -la {} \; || true
RUN sed -n '1,240p' node_modules/lightningcss/node/index.js || true
RUN ls -la node_modules/@swc || true
RUN ls -la node_modules/@tailwindcss || true
RUN find node_modules\/@tailwindcss -type f -name '*oxide*' -exec ls -la {} \; || true
# Diagnostic: print Node platform/arch/version
RUN node -e "console.log('platform', process.platform, 'arch', process.arch, 'node', process.versions.node)" || true

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.3-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["bun", "run", "start"]
