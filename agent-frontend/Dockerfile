# Build stage
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
# Copy files for pnpm install
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# Build project
COPY . .
RUN pnpm build

# Final stage
FROM nginx:stable-alpine
# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
