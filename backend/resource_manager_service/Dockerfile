FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Installa dipendenze di sistema: postgres-client, build tools, netcat, curl,
# librerie per Pillow e python-magic (libmagic1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    build-essential \
    netcat-openbsd \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Installa dipendenze Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia codice progetto
COPY . /app/

# Entrypoint (sarà un wrapper per avviare web e/o worker)
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Crea directory media (anche se montata)
RUN mkdir -p /app/mediafiles

# Porta per Gunicorn/Django (non per Celery worker)
EXPOSE 8003

# L'entrypoint gestirà l'avvio dei processi
ENTRYPOINT ["/app/entrypoint.sh"]