from django.contrib import admin
from .models import (
    Lesson,
    Quiz,
    QuizAnswer,
    Approfondimento,
    ActivityLog,
    UserProgress
)


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'user_id', 'status', 'lesson_length', 'created_at')
    list_filter = ('status', 'created_at', 'is_active')
    search_fields = ('title', 'user_id')
    readonly_fields = ('id', 'created_at', 'updated_at')
    list_per_page = 25
    
    fieldsets = (
        ('Informazioni Base', {
            'fields': ('title', 'user_id', 'status', 'lesson_length')
        }),
        ('Contenuto', {
            'fields': ('content',),
            'classes': ('wide',)
        }),
        ('Metadati', {
            'fields': ('id', 'created_at', 'updated_at', 'is_active'),
            'classes': ('collapse',)
        })
    )


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('lesson', 'total_questions', 'created_at')
    list_filter = ('created_at', 'is_active')
    search_fields = ('lesson__title',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'total_questions')


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ('quiz', 'user_id', 'question_index', 'is_correct', 'answered_at')
    list_filter = ('is_correct', 'answered_at', 'is_active')
    search_fields = ('user_id', 'quiz__lesson__title')
    readonly_fields = ('id', 'created_at', 'updated_at', 'answered_at')


@admin.register(Approfondimento)
class ApprofondimentoAdmin(admin.ModelAdmin):
    list_display = ('title', 'lesson', 'is_detailed', 'order', 'created_at')
    list_filter = ('is_detailed', 'created_at', 'is_active')
    search_fields = ('title', 'lesson__title')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Informazioni Base', {
            'fields': ('title', 'lesson', 'order', 'is_detailed')
        }),
        ('Contenuto', {
            'fields': ('content', 'detailed_content'),
            'classes': ('wide',)
        }),
        ('Metadati', {
            'fields': ('id', 'created_at', 'updated_at', 'is_active'),
            'classes': ('collapse',)
        })
    )


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'action', 'resource_type', 'created_at')
    list_filter = ('action', 'resource_type', 'created_at')
    search_fields = ('user_id', 'action', 'resource_type')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(UserProgress)
class UserProgressAdmin(admin.ModelAdmin):
    list_display = (
        'user_id', 
        'total_lessons', 
        'completed_lessons',
        'completion_rate_display',
        'quiz_accuracy_display',
        'last_activity'
    )
    list_filter = ('last_activity',)
    search_fields = ('user_id',)
    readonly_fields = (
        'id', 'created_at', 'updated_at', 
        'completion_rate', 'quiz_accuracy'
    )
    
    def completion_rate_display(self, obj):
        return f"{obj.completion_rate:.1f}%"
    completion_rate_display.short_description = 'Completamento'
    
    def quiz_accuracy_display(self, obj):
        return f"{obj.quiz_accuracy:.1f}%"
    quiz_accuracy_display.short_description = 'Accuratezza Quiz' 