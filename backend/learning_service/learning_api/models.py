from django.db import models
from django.utils import timezone
import uuid
import json


class BaseModel(models.Model):
    """Modello base con campi comuni."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        abstract = True


class Lesson(BaseModel):
    """Modello per le lezioni generate."""
    user_id = models.IntegerField(help_text="ID utente dal servizio auth")
    title = models.CharField(max_length=500, help_text="Titolo della lezione")
    content = models.TextField(help_text="Contenuto della mini-lezione")
    status = models.CharField(
        max_length=20,
        choices=[
            ('in_progress', 'In Corso'),
            ('completed', 'Completata'),
        ],
        default='in_progress'
    )
    lesson_length = models.IntegerField(default=15, help_text="Lunghezza in righe")
    depth_level = models.IntegerField(default=3, help_text="Livello di approfondimento (1-5)")
    
    class Meta:
        db_table = 'lessons'
        verbose_name = 'Lezione'
        verbose_name_plural = 'Lezioni'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', '-created_at']),
            models.Index(fields=['user_id', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.user_id})"
    
    @property
    def quiz_count(self):
        """Numero di quiz associati alla lezione."""
        return self.quizzes.filter(is_active=True).count()
    
    @property
    def approfondimenti_count(self):
        """Numero di approfondimenti associati alla lezione."""
        return self.approfondimenti.filter(is_active=True).count()


class Quiz(BaseModel):
    """Modello per i quiz delle lezioni."""
    lesson = models.ForeignKey(
        Lesson, 
        on_delete=models.CASCADE, 
        related_name='quizzes',
        help_text="Lezione associata"
    )
    questions = models.JSONField(
        default=list,
        help_text="Array di domande in formato JSON"
    )
    total_questions = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'quizzes'
        verbose_name = 'Quiz'
        verbose_name_plural = 'Quiz'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Quiz per {self.lesson.title}"
    
    def save(self, *args, **kwargs):
        if isinstance(self.questions, list):
            self.total_questions = len(self.questions)
        super().save(*args, **kwargs)


class QuizAnswer(BaseModel):
    """Modello per le risposte ai quiz."""
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    user_id = models.IntegerField(help_text="ID utente che ha risposto")
    question_index = models.IntegerField(help_text="Indice della domanda")
    answer_index = models.IntegerField(help_text="Indice della risposta scelta")
    is_correct = models.BooleanField(help_text="Se la risposta è corretta")
    answered_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'quiz_answers'
        verbose_name = 'Risposta Quiz'
        verbose_name_plural = 'Risposte Quiz'
        unique_together = ['quiz', 'user_id', 'question_index']
        ordering = ['-answered_at']
    
    def __str__(self):
        return f"Risposta di {self.user_id} al quiz {self.quiz.id}"


class Approfondimento(BaseModel):
    """Modello per gli approfondimenti delle lezioni."""
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='approfondimenti',
        help_text="Lezione associata"
    )
    title = models.CharField(max_length=200, help_text="Titolo dell'approfondimento")
    content = models.TextField(help_text="Contenuto dell'approfondimento")
    detailed_content = models.TextField(
        blank=True,
        help_text="Contenuto dettagliato (HTML)"
    )
    is_detailed = models.BooleanField(
        default=False,
        help_text="Se l'approfondimento è stato espanso"
    )
    order = models.IntegerField(default=0, help_text="Ordine di visualizzazione")
    
    class Meta:
        db_table = 'approfondimenti'
        verbose_name = 'Approfondimento'
        verbose_name_plural = 'Approfondimenti'
        ordering = ['lesson', 'order', '-created_at']
        indexes = [
            models.Index(fields=['lesson', 'order']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.lesson.title}"


class ActivityLog(BaseModel):
    """Log delle attività per auditing."""
    user_id = models.IntegerField()
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        db_table = 'activity_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.action} by User {self.user_id}"


class UserProgress(BaseModel):
    """Modello per tracciare il progresso dell'utente."""
    user_id = models.IntegerField(unique=True)
    total_lessons = models.IntegerField(default=0)
    completed_lessons = models.IntegerField(default=0)
    total_quiz_questions = models.IntegerField(default=0)
    correct_quiz_answers = models.IntegerField(default=0)
    total_approfondimenti = models.IntegerField(default=0)
    last_activity = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_progress'
        verbose_name = 'Progresso Utente'
        verbose_name_plural = 'Progressi Utenti'
    
    def __str__(self):
        return f"Progresso Utente {self.user_id}"
    
    @property
    def completion_rate(self):
        """Percentuale di completamento lezioni."""
        if self.total_lessons == 0:
            return 0
        return (self.completed_lessons / self.total_lessons) * 100
    
    @property
    def quiz_accuracy(self):
        """Percentuale di accuratezza nei quiz."""
        if self.total_quiz_questions == 0:
            return 0
        return (self.correct_quiz_answers / self.total_quiz_questions) * 100 