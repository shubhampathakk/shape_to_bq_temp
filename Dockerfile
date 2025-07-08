# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Install GDAL
RUN apk add --no-cache gdal

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server files and package.json
COPY server.cjs .
COPY package.json .

# Install production dependencies for the server
RUN npm install --omit=dev

# Expose the port your server will run on
EXPOSE 3000

# Start the server using the .cjs file
CMD ["node", "server.cjs"]