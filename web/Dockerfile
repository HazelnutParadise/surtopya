# Build stage
FROM oven/bun:1.3-slim AS builder

WORKDIR /app

# Install build dependencies that some native modules require
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (deterministic)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.3-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["bun", "run", "start"]
