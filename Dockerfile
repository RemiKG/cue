# Cue — one image that builds the PWA client and serves it + the Qwen proxy.
# Deploy target: Docker on Alibaba Cloud ECS/SAS (Singapore).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/tsconfig.json ./
EXPOSE 8787
# DASHSCOPE_API_KEY is provided at runtime (never baked into the image).
CMD ["node", "./node_modules/tsx/dist/cli.mjs", "server/index.ts"]
