# Generated manually for Resource Manager integration
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rag_api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='ragdocument',
            name='resource_id',
            field=models.PositiveBigIntegerField(blank=True, help_text='ID of the resource in ResourceManager', null=True),
        ),
    ] 