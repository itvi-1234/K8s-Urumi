FROM node:20-alpine

# Install Helm
RUN apk add --no-cache curl bash && \
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

CMD ["node", "src/controller.js"]
