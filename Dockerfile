FROM node:20-slim

# 1. Install Python 3 and basic build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Install Python Dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# 3. Install Node Dependencies
COPY package*.json ./
RUN npm install

# 4. Copy everything else
COPY . .

# 5. Build React Production Assets
RUN npm run build

# Environment Setup
EXPOSE 3001
ENV NODE_ENV=production
# Ensure node looks in the right place even with volume mounts
ENV NODE_PATH=/app/node_modules

# Start the Production Backend
CMD ["node", "server.cjs"]