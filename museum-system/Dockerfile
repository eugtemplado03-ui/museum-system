FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy app source
COPY . .

# Ensure uploads dir exists and is writable
RUN mkdir -p uploads && chown -R node:node uploads

USER node

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
