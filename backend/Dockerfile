FROM node:20-alpine

WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./
RUN npm install --production

# Copy source from backend directory
COPY backend/src ./src

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]

