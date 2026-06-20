# syntax=docker/dockerfile:1

# ---------- Build stage: compile the React app with Vite ----------
FROM node:20-slim AS builder

WORKDIR /app

# The backend API URL is baked into the static build at build time, since
# Vite env vars are resolved when the bundle is built, not at container
# runtime. docker-compose / your hosting platform's build step should pass
# this in (see README for Render/Vercel/Netlify instructions).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ---------- Runtime stage: serve the static build with nginx ----------
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
