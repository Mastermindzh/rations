FROM node:24.18.0-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24.18.0-alpine3.24 AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIRECTORY=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node src/styles ./src/styles
COPY --chown=node:node public ./public
COPY --chown=node:node scripts/hash-password.mjs ./scripts/hash-password.mjs
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
