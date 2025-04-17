# Stage 2: Final image
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Installa dipendenze di sistema necessarie per psycopg2, netcat, curl e potenzialmente librerie scientifiche
# build-essential/gcc è necessario se le librerie scientifiche compilano estensioni C
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    netcat-openbsd \
    curl \
    # Aggiungere qui altre dipendenze di sistema se richieste da pandas/sklearn,
    # es. libatlas-base-dev, gfortran, etc. (spesso non necessarie con wheels precompilati)
    && rm -rf /var/lib/apt/lists/*

# Installa dipendenze Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del progetto
COPY . /app/

# Copia entrypoint script e rendilo eseguibile
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Crea la directory per i media files (anche se verrà montata da volume)
RUN mkdir -p /app/mediafiles

# Esponi la porta 8001 (diversa da auth_service)
EXPOSE 8001

# Esegui entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]