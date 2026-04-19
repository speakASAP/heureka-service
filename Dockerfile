FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --prefer-offline --no-audit || npm ci

COPY . .

# Install root dependencies first (needed for file: symlinks)
RUN npm install --prefer-offline --no-audit

WORKDIR /app/services/aukro-service
RUN npm run build || (echo "❌ Build failed in aukro-service" >&2; exit 1)

# Verify dist/ was created and copy to /app
RUN test -f dist/main.js || (echo "❌ dist/main.js not found after build" >&2; exit 1) && \
    cd /app && \
    cp -r services/aukro-service/dist ./dist || (echo "❌ Failed to copy dist/ directory" >&2; exit 1) && \
    test -f /app/dist/main.js || (echo "❌ dist/main.js not found in final location /app/dist/" >&2; exit 1)

WORKDIR /app

EXPOSE 3000

ENTRYPOINT ["node"]
CMD ["dist/main.js"]
