FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (ignoring devDependencies issues by using npm install or ci)
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the frontend application
RUN npm run build

# Cloud Run expected PORT
ENV PORT=3000
ENV NODE_ENV=production

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
