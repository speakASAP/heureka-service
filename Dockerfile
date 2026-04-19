FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --prefer-offline --no-audit || npm ci

COPY . .

# Install root dependencies
RUN npm install --prefer-offline --no-audit

# Build shared module first (required dependency)
RUN cd /app/shared && npm run build

WORKDIR /app/services/aukro-service
RUN npm run build

# Copy dist to /app
RUN cd /app && cp -r services/aukro-service/dist ./dist

EXPOSE 3000

ENTRYPOINT ["node"]
CMD ["dist/main.js"]
