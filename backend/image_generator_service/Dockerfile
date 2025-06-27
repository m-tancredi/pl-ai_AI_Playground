FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Installa dipendenze di sistema (aggiunto libpq-dev per psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    netcat-openbsd \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Installa dipendenze Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia codice
COPY . /app/

# Entrypoint
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Directory media
RUN mkdir -p /app/mediafiles/temp_generated # Dir temporanea (quella saved verrà creata dinamicamente)

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]