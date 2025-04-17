# Use the official Nginx image from Docker Hub
FROM nginx:1.25-alpine

# Remove the default Nginx configuration file
RUN rm /etc/nginx/conf.d/default.conf

# Copy the custom configuration file from the nginx directory to the container
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80 (which will be mapped to the host's 8080 in docker-compose)
EXPOSE 80

# Nginx will start automatically when the container launches
# using the default CMD from the base image: ["nginx", "-g", "daemon off;"]