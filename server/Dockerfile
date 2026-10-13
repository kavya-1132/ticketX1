FROM node:20-alpine

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies exactly as locked
RUN npm ci --omit=dev

# Copy application source
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
