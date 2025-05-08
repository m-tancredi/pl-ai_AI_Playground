# Consider using an official TensorFlow image as base if you encounter complex dependency issues
# FROM tensorflow/tensorflow:latest-gpu-jupyter # Example GPU image
# FROM tensorflow/tensorflow:latest # Example CPU image
# If using TF base image, ensure Python version matches and install other deps via pip/apt
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# Optional: Control TensorFlow logging level
ENV TF_CPP_MIN_LOG_LEVEL=${TF_CPP_MIN_LOG_LEVEL:-2}

WORKDIR /app

# Install system dependencies: postgres-client, build tools, netcat, curl, Pillow libs
# Potentially add other libraries needed by TensorFlow/Keras if not using TF base image
# (e.g., libhdf5-dev, potentially CUDA/CuDNN drivers for GPU)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    build-essential \
    netcat-openbsd \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    git \ 
    autoconf \ 
    automake \ 
    libtool \  
    pkg-config \
    # Add any other TF prerequisites if needed for python:3.10-slim
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
# Consider using a virtual environment inside Docker if needed
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . /app/

# Entrypoint script
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create directory for saved models (even if volume mounted)
RUN mkdir -p /app/models_storage

# Expose port for Gunicorn/Django web server
EXPOSE 8004
# Entrypoint will handle starting processes
ENTRYPOINT ["/app/entrypoint.sh"]