# Build stage: full deps (tsc + vite live in dependencies, but keep dev tools
# available for the build) and produce dist/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: production server (Express + socket.io serving dist/).
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY protocol.json ./protocol.json

# Persistence (optional): mount a volume and set
#   LOOPDUEL_PERSISTENCE_PATH=/data/rooms.json
# or rooms are lost when the container stops. Set LOOPDUEL_ALLOWED_ORIGINS to
# your https origin(s) — production refuses cross-origin sockets otherwise.
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-4173}/healthz || exit 1
CMD ["node", "server/index.mjs"]
