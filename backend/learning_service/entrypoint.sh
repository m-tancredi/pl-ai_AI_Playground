#!/bin/bash

# Wait for database
echo "Waiting for database..."
while ! nc -z $SERVICE_DB_HOST $SERVICE_DB_PORT; do
  sleep 0.1
done
echo "Database connected!"

# Run migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Create superuser if not exists
echo "Creating superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created')
else:
    print('Superuser already exists')
"

# Collect static files
python manage.py collectstatic --noinput

# Start server
echo "Starting learning service..."
python manage.py runserver 0.0.0.0:8000 