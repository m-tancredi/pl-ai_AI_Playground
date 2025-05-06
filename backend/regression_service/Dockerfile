FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Rimosso libpq-dev. Mantenute le altre dipendenze necessarie.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    netcat-openbsd \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    # libmagic1 non necessario qui
    # git non necessario qui (a meno di altre dipendenze)
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Non serve più creare mediafiles qui

EXPOSE 8001
ENTRYPOINT ["/app/entrypoint.sh"]