FROM node:20-alpine

# Install Helm and dependencies
RUN apk add --no-cache curl bash openssl && \
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

WORKDIR /app

# Copy package files from orchestrator directory
COPY orchestrator/package*.json ./
RUN npm install --production

# Copy source from orchestrator directory
COPY orchestrator/src ./src

# Copy helm charts from root helm directory
COPY helm ./helm

# Set default chart path to point to the copied charts
ENV WOOCOMMERCE_CHART_PATH=/app/helm/store-templates/woocommerce

CMD ["node", "src/controller.js"]

