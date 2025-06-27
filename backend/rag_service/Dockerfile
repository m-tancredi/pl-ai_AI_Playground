FROM python:3.11-slim

# Imposta variabili d'ambiente
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Installa dipendenze di sistema
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ita \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crea directory di lavoro
WORKDIR /app

# Copia e installa dipendenze Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice dell'applicazione
COPY . /app/

# Crea directory per upload e embeddings
RUN mkdir -p /app/rag_uploads /app/rag_embeddings

# Espone la porta
EXPOSE 8000

# Script di entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Imposta l'entrypoint
ENTRYPOINT ["bash", "/app/entrypoint.sh"]

# Comando di default (vuoto per permettere all'entrypoint di gestire il tipo di processo)
CMD [] 