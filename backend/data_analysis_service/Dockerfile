FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV TF_CPP_MIN_LOG_LEVEL=${TF_CPP_MIN_LOG_LEVEL:-2}

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    build-essential \
    netcat-openbsd \
    curl \
    git \ 
    autoconf automake libtool pkg-config libc-dev \ 
    # Aggiungere dipendenze per Pillow/Plotly/Matplotlib se necessario
    # libjpeg-dev zlib1g-dev libfreetype6-dev liblcms2-dev libwebp-dev tk-dev
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/analysis_results_storage

EXPOSE 8005 
ENTRYPOINT ["/app/entrypoint.sh"]