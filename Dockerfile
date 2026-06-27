# HardWare Plus POS — Container image
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public  ./public

# Persistent data volume (SQLite DB lives here — encrypt at host level)
VOLUME ["/app/data"]
ENV POS_DB=/app/data/pos.db

EXPOSE 3000

# Seed on first run if DB is empty, then start server
CMD ["node", "--experimental-sqlite", "server/app.js"]
