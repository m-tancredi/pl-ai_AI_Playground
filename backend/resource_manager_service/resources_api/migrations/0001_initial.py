# Generated by Django 4.2.20 on 2025-04-24 09:02

from django.db import migrations, models
import resources_api.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Resource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('owner_id', models.PositiveBigIntegerField(db_index=True, help_text='User ID from the authentication service')),
                ('file', models.FileField(help_text='The main resource file stored', max_length=512, upload_to=resources_api.models.user_resource_path)),
                ('original_filename', models.CharField(help_text='Original filename as uploaded by the user', max_length=255)),
                ('status', models.CharField(choices=[('PROCESSING', 'Processing'), ('COMPLETED', 'Completed'), ('FAILED', 'Failed')], db_index=True, default='PROCESSING', help_text='Processing status of the resource', max_length=20)),
                ('mime_type', models.CharField(blank=True, help_text='Detected MIME type', max_length=100, null=True)),
                ('size', models.PositiveBigIntegerField(blank=True, help_text='File size in bytes', null=True)),
                ('name', models.CharField(blank=True, help_text='User-defined name for the resource', max_length=255)),
                ('description', models.TextField(blank=True, help_text='User-defined description')),
                ('metadata', models.JSONField(blank=True, help_text='Extracted metadata (e.g., image dimensions, CSV headers)', null=True)),
                ('thumbnail', models.ImageField(blank=True, help_text='Path to the generated thumbnail (if applicable)', max_length=512, null=True, upload_to=resources_api.models.user_thumbnail_path)),
                ('error_message', models.TextField(blank=True, help_text='Details if processing failed', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['owner_id', 'status'], name='resources_a_owner_i_eec3fa_idx')],
            },
        ),
    ]
