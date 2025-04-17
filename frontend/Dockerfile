# Stage 1: Build the React application
FROM node:18-alpine as builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the static files using a lightweight server (serve)
FROM node:18-alpine

WORKDIR /app

# Install `serve` globally
RUN npm install -g serve

# Copy the build output from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port `serve` will listen on (default is 3000)
EXPOSE 3000

# Command to run `serve` to serve the 'dist' folder
# -s indicates single-page application mode (serves index.html for unknown routes)
# -l specifies the port
CMD ["serve", "-s", "dist", "-l", "3000"]