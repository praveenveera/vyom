// ─────────────────────────────────────────────────────────────────────────────
// plugin-docker — Dockerfile and docker-compose generators
// ─────────────────────────────────────────────────────────────────────────────

import type { Project } from '@garagebuild/plugin-sdk';

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export function dockerfile(project: Project): string {
  const label = safeName(project.name);
  return `# syntax=docker/dockerfile:1
# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npm run build

# ── Serve stage ────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
LABEL app="${label}"
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf 'server {\\n  listen 80;\\n  server_name _;\\n  location / {\\n    root /usr/share/nginx/html;\\n    index index.html;\\n    try_files $uri $uri/ /index.html;\\n  }\\n}\\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

export function composeFile(project: Project, port: number = 3000): string {
  const svc = safeName(project.name);
  return `version: '3.8'
services:
  ${svc}:
    build: .
    image: ${svc}:latest
    container_name: ${svc}
    ports:
      - "${port}:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
`;
}
