FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Installa dipendenze di sistema
# Pillow potrebbe necessitare di libjpeg-dev, zlib1g-dev etc.
# Aggiungili se pip install Pillow fallisce.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    netcat-openbsd \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    # Aggiungere altre dipendenze immagine se necessario
    && rm -rf /var/lib/apt/lists/*

# Installa dipendenze Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del progetto
COPY . /app/

# Copia entrypoint script e rendilo eseguibile
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Crea directory per media e file temporanei (anche se montate da volume)
RUN mkdir -p /app/mediafiles/temp_generated

# Esponi la porta 8002
EXPOSE 8002

# Esegui entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]