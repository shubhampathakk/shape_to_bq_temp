# Stage 1: Build the React application
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the final production image
FROM node:20-bookworm-slim
WORKDIR /app

# Install GDAL and the unzip utility
RUN apt-get update && \
    apt-get install -y gdal-bin unzip --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copy the server files and install server dependencies (including @google-cloud/storage)
COPY server.cjs .
COPY package.json .
RUN npm install --omit=dev

# Copy the built React app
COPY --from=builder /app/dist ./dist

# Create the uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["node", "server.cjs"]