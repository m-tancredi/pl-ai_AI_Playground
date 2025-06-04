from django.db import models

class Chat(models.Model):
    user_id = models.IntegerField(null=True, blank=True)
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    chat = models.ForeignKey(Chat, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=20)  # 'user' o 'assistant'
    content = models.TextField()
    model = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatSettings(models.Model):
    chat = models.OneToOneField(Chat, related_name='settings', on_delete=models.CASCADE)
    grade = models.CharField(max_length=50, null=True, blank=True)
    mode = models.CharField(max_length=50, null=True, blank=True)
    subject = models.CharField(max_length=100, null=True, blank=True)
    model = models.CharField(max_length=100, null=True, blank=True)
    system_prompt = models.TextField(null=True, blank=True) 