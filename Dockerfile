FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: runtime - copy deps and source, run as non-root
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV TZ=UTC
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]