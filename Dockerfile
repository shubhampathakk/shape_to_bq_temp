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

# Stage 2: Serve the application from a lightweight web server
FROM nginx:stable-alpine

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the Nginx server
EXPOSE 80

# The default Nginx command will start the server
CMD ["nginx", "-g", "daemon off;"]
