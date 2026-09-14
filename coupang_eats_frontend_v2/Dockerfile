# Multi-stage: Vite SPA → Nginx reverse proxy (WEB tier)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/50x.html /usr/share/nginx/html/50x.html
COPY public/errors/ /usr/share/nginx/html/errors/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
