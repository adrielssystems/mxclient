# Stage 1: Base image
FROM node:22-slim AS base
WORKDIR /app
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
# Instalamos pnpm globalmente para que no dependa de corepack en runtime
RUN npm install -g pnpm@11.1.2

# Stage 2: Build stage
FROM base AS builder
RUN pnpm config set store-dir /pnpm/store
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

COPY . .
ENV NODE_ENV=production
RUN pnpm run build
RUN pnpm prune --prod --ignore-scripts

# Stage 3: Runner (Final production image)
FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

EXPOSE 4000
# Ejecutamos node directamente para evitar que pnpm verifique nada al arrancar
CMD ["node", "./build/server/index.js"]
