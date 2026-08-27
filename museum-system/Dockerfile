FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy app source
COPY . .

# Ensure uploads dir exists internally as fallback
RUN mkdir -p uploads

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
