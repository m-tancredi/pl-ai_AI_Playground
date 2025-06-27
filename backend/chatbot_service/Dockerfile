FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Installa dipendenze di sistema necessarie per Postgres, Pillow, ecc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    netcat-openbsd \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Installa dipendenze Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del progetto
COPY . /app/

# Copia entrypoint script e rendilo eseguibile
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Espone la porta 8001 (puoi cambiarla se preferisci)
EXPOSE 8000

# Esegui entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"] 