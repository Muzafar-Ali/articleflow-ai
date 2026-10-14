
# Stage 1: Compile the TypeScript application.
FROM node:24.21.0-alpine AS builder

WORKDIR /app

RUN npm install --global npm@12.0.2

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY prisma7.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Prisma Client generation requires a URL for configuration
# validation, but does not connect to PostgreSQL.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm run db:generate && npm run build


# Stage 2: Run compiled JavaScript with production dependencies.
FROM node:24.21.0-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN npm install --global npm@12.0.2

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
