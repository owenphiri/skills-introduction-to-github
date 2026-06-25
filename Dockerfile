# SafeGirl EduTrack — container image.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

# Persistent, encryptable data volume (DB lives here).
VOLUME ["/app/data"]
ENV SEWSMS_DB=/app/data/sewsms.db

EXPOSE 3000

# Built-in SQLite needs the experimental flag on Node 22.
CMD ["node", "--experimental-sqlite", "server/app.js"]
