# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# npm ci statt npm install: reproduzierbar, nutzt exakt das Lockfile.
RUN npm ci

COPY . .

# Vite ersetzt import.meta.env.* zur BUILD-Zeit. Der Wert muss also hier
# feststehen, eine Umgebungsvariable im laufenden Container wirkt nicht mehr.
# Leer = relative URLs, weil nginx unten zum Backend proxyt.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Laufzeit ─────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/. /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
