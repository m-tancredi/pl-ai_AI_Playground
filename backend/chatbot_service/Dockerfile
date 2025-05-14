FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV TF_CPP_MIN_LOG_LEVEL=${TF_CPP_MIN_LOG_LEVEL:-2}

WORKDIR /app

# Installa dipendenze di sistema
# libpq-dev per psycopg2
# build-essential, gcc per compilazioni C generiche
# git, autoconf, ecc. per librabbitmq
# PyMuPDF (fitz) potrebbe necessitare di alcune librerie C, ma spesso il wheel le include.
# Verificare se sono necessarie: libmupdf-dev, swig
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    build-essential \
    netcat-openbsd \
    curl \
    git \
    autoconf automake libtool pkg-config libc-dev \
    # Aggiungere qui se PyMuPDF dà errori di build:
    # swig libmupdf-dev mupdf-tools
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Non ci sono media files gestiti direttamente da questo servizio
# quindi non serve `mkdir -p /app/mediafiles`

EXPOSE 8006
ENTRYPOINT ["/app/entrypoint.sh"]