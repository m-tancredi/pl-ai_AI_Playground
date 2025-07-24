from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.db import transaction
from .models import (
    Lesson, 
    Quiz, 
    QuizAnswer, 
    Approfondimento, 
    ActivityLog, 
    UserProgress
)
from .serializers import (
    LessonSerializer, 
    LessonCreateSerializer,
    LessonUpdateSerializer,
    LessonListSerializer,
    LessonWithRelatedSerializer,
    QuizSerializer,
    QuizCreateSerializer,
    QuizAnswerSerializer,
    QuizAnswerCreateSerializer,
    ApprofondimentoSerializer,
    ApprofondimentoCreateSerializer,
    ApprofondimentoUpdateSerializer,
    ActivityLogSerializer,
    UserProgressSerializer,
    LessonGenerateSerializer,
    QuizGenerateSerializer,
    ApprofondimentiGenerateSerializer,
    DetailedApprofondimentoGenerateSerializer
)
from .permissions import (
    IsOwnerOrReadOnly, 
    IsOwnerOnly, 
    CanGenerateContent,
    CanViewUserProgress,
    CanSubmitQuizAnswers
)
from .config.openai_client import openai_client
from .utils.usage_tracking import calculate_learning_usage_summary
import logging

logger = logging.getLogger(__name__)


class LessonViewSet(viewsets.ModelViewSet):
    """ViewSet per gestione delle lezioni."""
    
    permission_classes = [IsAuthenticated]  # Solo autenticazione base
    
    def get_queryset(self):
        """Filtra per utente corrente."""
        user_id = getattr(self.request.user, 'id', None)
        if user_id:
            return Lesson.objects.filter(
                user_id=user_id,
                is_active=True
            ).prefetch_related('quizzes', 'approfondimenti')
        else:
            # Se non c'è user_id, restituisce queryset vuoto
            return Lesson.objects.none()
    
    def get_serializer_class(self):
        """Sceglie il serializer in base all'azione."""
        if self.action == 'list':
            return LessonListSerializer
        elif self.action == 'create':
            return LessonCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return LessonUpdateSerializer
        elif self.action in ['retrieve', 'with_related']:
            return LessonWithRelatedSerializer
        return LessonSerializer
    
    def perform_create(self, serializer):
        """Crea lezione con logging."""
        instance = serializer.save()
        self._log_activity('CREATE_LESSON', instance)
        self._update_user_progress()
        logger.info(f"Utente {self.request.user.id} ha creato la lezione {instance.title}")
    
    def perform_update(self, serializer):
        """Aggiorna lezione con logging."""
        instance = serializer.save()
        self._log_activity('UPDATE_LESSON', instance)
        logger.info(f"Utente {self.request.user.id} ha aggiornato la lezione {instance.title}")
    
    def perform_destroy(self, instance):
        """Soft delete con logging."""
        instance.is_active = False
        instance.save()
        self._log_activity('DELETE_LESSON', instance)
        self._update_user_progress()
        logger.info(f"Utente {self.request.user.id} ha eliminato la lezione {instance.title}")
    
    @action(detail=True, methods=['get'])
    def with_related(self, request, pk=None):
        """Endpoint per lezione con quiz e approfondimenti."""
        lesson = self.get_object()
        serializer = LessonWithRelatedSerializer(lesson)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_lessons(self, request):
        """Endpoint per lezioni dell'utente corrente."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = LessonListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = LessonListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Ricerca nelle lezioni."""
        query = request.query_params.get('q', '')
        if not query:
            return Response({'error': 'Parametro q richiesto'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        queryset = self.get_queryset().filter(
            Q(title__icontains=query) | Q(content__icontains=query)
        )
        
        serializer = LessonListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def generate(self, request):
        """Genera una nuova lezione usando OpenAI."""
        serializer = LessonGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        topic = serializer.validated_data['topic']
        depth_level = serializer.validated_data.get('depth_level', 3)
        model = serializer.validated_data.get('model', 'gpt-3.5-turbo')
        
        try:
            content = openai_client.generate_lesson(topic, depth_level=depth_level, user_id=request.user.id, model=model)
            
            user_id = getattr(request.user, 'id', None)
            if not user_id:
                return Response({
                    'success': False,
                    'error': 'User ID non disponibile'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            lesson = Lesson.objects.create(
                user_id=user_id,
                title=topic,
                content=content,
                depth_level=depth_level,
                status='in_progress'
            )
            
            return Response({
                'success': True,
                'lesson': LessonSerializer(lesson).data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def generate_quiz(self, request, pk=None):
        """Genera quiz per una lezione."""
        lesson = self.get_object()
        
        # Ottieni i parametri dalla richiesta
        difficulty_level = request.data.get('difficulty_level', 3)
        num_questions = request.data.get('num_questions', 5)
        include_approfondimenti = request.data.get('include_approfondimenti', True)
        model = request.data.get('model', 'gpt-3.5-turbo')
        
        try:
            # Ottieni approfondimenti se richiesti
            approfondimenti = None
            if include_approfondimenti:
                approfondimenti = lesson.approfondimenti.filter(is_active=True).values('title', 'content')
                approfondimenti = list(approfondimenti) if approfondimenti else None
            
            questions = openai_client.generate_quiz(
                lesson.content, 
                lesson.title,
                approfondimenti=approfondimenti,
                num_questions=num_questions,
                difficulty_level=difficulty_level,
                user_id=request.user.id,  # ⚠️ Passa user_id per tracking
                model=model
            )
            
            quiz, created = Quiz.objects.get_or_create(
                lesson=lesson,
                defaults={'questions': questions}
            )
            
            if not created:
                quiz.questions = questions
                quiz.save()
            
            return Response({
                'success': True,
                'quiz': QuizSerializer(quiz).data
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def generate_approfondimenti(self, request, pk=None):
        """Genera approfondimenti per una lezione."""
        lesson = self.get_object()
        
        serializer = ApprofondimentiGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        max_items = serializer.validated_data.get('max_items')
        depth_level = serializer.validated_data.get('depth_level', lesson.depth_level)
        existing_approfondimenti = serializer.validated_data.get('existing_approfondimenti', [])
        model = serializer.validated_data.get('model', 'gpt-3.5-turbo')
        
        try:
            # Genera gli approfondimenti
            approfondimenti_data = openai_client.generate_approfondimenti(
                lesson.title,
                lesson.content,
                max_items,
                depth_level=depth_level,
                existing_approfondimenti=existing_approfondimenti,
                user_id=request.user.id,  # ⚠️ Passa user_id per tracking
                model=model
            )
            
            # Crea gli approfondimenti nel database
            approfondimenti = []
            for i, app_data in enumerate(approfondimenti_data):
                approfondimento = Approfondimento.objects.create(
                    lesson=lesson,
                    title=app_data['title'],
                    content=app_data['content'],
                    order=i
                )
                approfondimenti.append(approfondimento)
            
            self._log_activity('GENERATE_APPROFONDIMENTI', lesson)
            self._update_user_progress()
            
            serializer = ApprofondimentoSerializer(approfondimenti, many=True)
            return Response({
                'success': True,
                'approfondimenti': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Errore nella generazione degli approfondimenti: {str(e)}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _log_activity(self, action, lesson):
        """Helper per logging attività."""
        ActivityLog.objects.create(
            user_id=self.request.user.id,
            action=action,
            resource_type='Lesson',
            resource_id=str(lesson.id),
            details={
                'title': lesson.title,
                'timestamp': lesson.updated_at.isoformat()
            },
            ip_address=self._get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        )
    
    def _update_user_progress(self):
        """Aggiorna il progresso dell'utente."""
        try:
            user_progress, created = UserProgress.objects.get_or_create(
                user_id=self.request.user.id
            )
            
            # Calcola le statistiche
            lessons = Lesson.objects.filter(
                user_id=self.request.user.id,
                is_active=True
            )
            
            user_progress.total_lessons = lessons.count()
            user_progress.completed_lessons = lessons.filter(status='completed').count()
            user_progress.total_approfondimenti = Approfondimento.objects.filter(
                lesson__user_id=self.request.user.id,
                is_active=True
            ).count()
            
            # Statistiche quiz
            quiz_answers = QuizAnswer.objects.filter(
                user_id=self.request.user.id
            )
            user_progress.total_quiz_questions = quiz_answers.count()
            user_progress.correct_quiz_answers = quiz_answers.filter(is_correct=True).count()
            
            user_progress.save()
            
        except Exception as e:
            logger.error(f"Errore nell'aggiornamento del progresso utente: {str(e)}")
    
    @action(detail=True, methods=['get'], url_path='export/pdf')
    def export_pdf(self, request, pk=None):
        """
        Esporta una lezione in formato PDF.
        
        Query parameters:
        - include_approfondimenti (bool): Include approfondimenti nel PDF (default: true)
        - include_quiz (bool): Include quiz nel PDF (default: true)
        """
        try:
            from .utils.pdf_generator import pdf_generator
            
            lesson = self.get_object()
            
            # Parametri opzionali
            include_approfondimenti = request.query_params.get('include_approfondimenti', 'true').lower() == 'true'
            include_quiz = request.query_params.get('include_quiz', 'true').lower() == 'true'
            
            # Genera PDF
            pdf_response = pdf_generator.generate_single_lesson_pdf(
                lesson=lesson,
                include_approfondimenti=include_approfondimenti,
                include_quiz=include_quiz
            )
            
            # Log attività
            self._log_activity(
                lesson_id=lesson.id,
                action='pdf_export',
                details={'include_approfondimenti': include_approfondimenti, 'include_quiz': include_quiz}
            )
            
            return pdf_response
            
        except Exception as e:
            logger.error(f"Errore nell'export PDF per lezione {pk}: {str(e)}")
            return Response({
                'error': f'Errore nella generazione del PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='export/bulk-pdf')
    def export_bulk_pdf(self, request):
        """
        Esporta multiple lezioni in un singolo PDF.
        
        Body parameters:
        - lesson_ids (list): Lista degli ID delle lezioni da esportare
        - filename_prefix (str): Prefisso per il nome del file (optional)
        """
        try:
            from .utils.pdf_generator import pdf_generator
            
            lesson_ids = request.data.get('lesson_ids', [])
            filename_prefix = request.data.get('filename_prefix', 'lezioni')
            
            if not lesson_ids:
                return Response({
                    'error': 'Nessuna lezione specificata per l\'export'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Recupera le lezioni (solo quelle dell'utente)
            lessons = self.get_queryset().filter(id__in=lesson_ids)
            
            if not lessons.exists():
                return Response({
                    'error': 'Nessuna lezione valida trovata'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Genera PDF
            pdf_response = pdf_generator.generate_bulk_lessons_pdf(
                lessons=lessons,
                filename_prefix=filename_prefix
            )
            
            # Log attività per ogni lezione
            for lesson in lessons:
                self._log_activity(
                    lesson_id=lesson.id,
                    action='bulk_pdf_export',
                    details={'total_lessons': len(lessons), 'filename_prefix': filename_prefix}
                )
            
            return pdf_response
            
        except Exception as e:
            logger.error(f"Errore nell'export PDF bulk: {str(e)}")
            return Response({
                'error': f'Errore nella generazione del PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_client_ip(self):
        """Ottiene IP del client."""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return self.request.META.get('REMOTE_ADDR')


class QuizAnswerViewSet(viewsets.ModelViewSet):
    """ViewSet per gestione delle risposte ai quiz."""
    
    permission_classes = [IsAuthenticated, CanSubmitQuizAnswers]
    
    def get_queryset(self):
        """Filtra per utente corrente."""
        return QuizAnswer.objects.filter(
            user_id=self.request.user.id,
            is_active=True
        ).select_related('quiz', 'quiz__lesson')
    
    def get_serializer_class(self):
        """Sceglie il serializer in base all'azione."""
        if self.action == 'create':
            return QuizAnswerCreateSerializer
        return QuizAnswerSerializer
    
    def perform_create(self, serializer):
        """Crea risposta con aggiornamento progresso."""
        instance = serializer.save()
        self._update_lesson_progress(instance.quiz.lesson)
        logger.info(f"Utente {self.request.user.id} ha risposto al quiz {instance.quiz.id}")
    
    @action(detail=False, methods=['post'])
    def submit_answer(self, request):
        """Endpoint per inviare una risposta al quiz."""
        serializer = QuizAnswerCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Verifica se l'utente ha già risposto a questa domanda
        quiz = serializer.validated_data['quiz']
        question_index = serializer.validated_data['question_index']
        
        existing_answer = QuizAnswer.objects.filter(
            quiz=quiz,
            user_id=request.user.id,
            question_index=question_index
        ).first()
        
        if existing_answer:
            # Aggiorna la risposta esistente
            for key, value in serializer.validated_data.items():
                setattr(existing_answer, key, value)
            existing_answer.save()
            answer = existing_answer
        else:
            # Crea nuova risposta
            answer = serializer.save()
        
        self._update_lesson_progress(quiz.lesson)
        
        return Response({
            'success': True,
            'answer': QuizAnswerSerializer(answer).data,
            'is_correct': answer.is_correct
        })
    
    def _update_lesson_progress(self, lesson):
        """Aggiorna il progresso della lezione."""
        try:
            # Verifica se tutti i quiz sono stati completati
            quiz = lesson.quizzes.filter(is_active=True).first()
            if quiz:
                user_answers = QuizAnswer.objects.filter(
                    quiz=quiz,
                    user_id=self.request.user.id
                ).count()
                
                # Se l'utente ha risposto a tutte le domande, marca la lezione come completata
                if user_answers >= quiz.total_questions:
                    lesson.status = 'completed'
                    lesson.save()
                    
                    # Aggiorna progresso utente
                    user_progress, created = UserProgress.objects.get_or_create(
                        user_id=self.request.user.id
                    )
                    user_progress.completed_lessons = Lesson.objects.filter(
                        user_id=self.request.user.id,
                        status='completed',
                        is_active=True
                    ).count()
                    user_progress.save()
                    
        except Exception as e:
            logger.error(f"Errore nell'aggiornamento del progresso della lezione: {str(e)}")


class ApprofondimentoViewSet(viewsets.ModelViewSet):
    """ViewSet per gestione degli approfondimenti."""
    
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """Filtra per utente corrente."""
        return Approfondimento.objects.filter(
            lesson__user_id=self.request.user.id,
            is_active=True
        ).select_related('lesson')
    
    def get_serializer_class(self):
        """Sceglie il serializer in base all'azione."""
        if self.action == 'create':
            return ApprofondimentoCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ApprofondimentoUpdateSerializer
        return ApprofondimentoSerializer
    
    @action(detail=True, methods=['post'])
    def generate_detailed(self, request, pk=None):
        """Genera contenuto dettagliato per un approfondimento."""
        approfondimento = self.get_object()
        model = request.data.get('model', 'gpt-3.5-turbo')
        
        try:
            detailed_content = openai_client.generate_detailed_approfondimento(
                approfondimento.title,
                approfondimento.lesson.title,
                approfondimento.lesson.content,
                user_id=request.user.id,  # ⚠️ Passa user_id per tracking
                model=model
            )
            
            approfondimento.detailed_content = detailed_content
            approfondimento.is_detailed = True
            approfondimento.save()
            
            serializer = ApprofondimentoSerializer(approfondimento)
            return Response({
                'success': True,
                'approfondimento': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Errore nella generazione dell'approfondimento dettagliato: {str(e)}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserProgressViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet per visualizzazione progresso utente."""
    
    permission_classes = [IsAuthenticated, CanViewUserProgress]
    serializer_class = UserProgressSerializer
    
    def get_queryset(self):
        """Filtra per utente corrente."""
        return UserProgress.objects.filter(user_id=self.request.user.id)
    
    @action(detail=False, methods=['get'])
    def my_progress(self, request):
        """Endpoint per il progresso dell'utente corrente."""
        user_progress, created = UserProgress.objects.get_or_create(
            user_id=request.user.id
        )
        
        if created:
            # Calcola le statistiche se è appena stato creato
            LessonViewSet()._update_user_progress(self)
            user_progress.refresh_from_db()
        
        serializer = UserProgressSerializer(user_progress)
        return Response(serializer.data)
    
    @method_decorator(cache_page(60 * 15))  # Cache per 15 minuti
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiche avanzate dell'utente."""
        user_id = request.user.id
        
        # Statistiche delle lezioni
        lessons_stats = Lesson.objects.filter(
            user_id=user_id,
            is_active=True
        ).aggregate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='completed'))
        )
        
        # Statistiche dei quiz
        quiz_stats = QuizAnswer.objects.filter(
            user_id=user_id
        ).aggregate(
            total_answers=Count('id'),
            correct_answers=Count('id', filter=Q(is_correct=True))
        )
        
        # Statistiche degli approfondimenti
        approfondimenti_stats = Approfondimento.objects.filter(
            lesson__user_id=user_id,
            is_active=True
        ).aggregate(
            total=Count('id'),
            detailed=Count('id', filter=Q(is_detailed=True))
        )
        
        return Response({
            'lessons': lessons_stats,
            'quiz': quiz_stats,
            'approfondimenti': approfondimenti_stats,
            'accuracy': (
                quiz_stats['correct_answers'] / quiz_stats['total_answers'] * 100
                if quiz_stats['total_answers'] > 0 else 0
            ),
            'completion_rate': (
                lessons_stats['completed'] / lessons_stats['total'] * 100
                if lessons_stats['total'] > 0 else 0
            )
        })


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet per visualizzazione log attività."""
    
    permission_classes = [IsAuthenticated]
    serializer_class = ActivityLogSerializer
    
    def get_queryset(self):
        """Filtra per utente corrente."""
        return ActivityLog.objects.filter(
            user_id=self.request.user.id,
            is_active=True
        ).order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Attività recenti dell'utente."""
        recent_activities = self.get_queryset()[:10]
        serializer = ActivityLogSerializer(recent_activities, many=True)
        return Response(serializer.data)


class LearningUsageTrackingView(viewsets.ViewSet):
    """API per recuperare i dati di utilizzo del Learning Service."""
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """
        Recupera i dati di utilizzo per l'utente corrente.
        
        Query params:
        - period: Periodo ('current_month', 'last_30_days', 'all_time')
        """
        period = request.query_params.get('period', 'current_month')
        
        try:
            user_id = request.user.id
            
            # 🔧 Calcola summary con error handling robusto
            try:
                summary = calculate_learning_usage_summary(user_id, period)
                
                # 🔧 CRITICAL: Converti Decimal a float per serializzazione JSON
                def convert_decimals(obj):
                    """Converte ricorsivamente Decimal objects in float per JSON serialization"""
                    if isinstance(obj, dict):
                        return {k: convert_decimals(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [convert_decimals(item) for item in obj]
                    elif hasattr(obj, '__class__') and obj.__class__.__name__ == 'Decimal':
                        return float(obj)
                    else:
                        return obj
                
                summary = convert_decimals(summary)
                logger.info(f"✅ Summary calcolato e convertito per user {user_id}")
                
            except Exception as summary_error:
                logger.error(f"❌ Errore calcolo summary per user {user_id}: {summary_error}")
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                # Fallback con dati vuoti
                summary = {
                    'total_tokens': 0,
                    'total_cost_usd': 0.0,
                    'total_cost_eur': 0.0,
                    'total_calls': 0,
                    'successful_calls': 0,
                    'failed_calls': 0,
                    'success_rate': 100.0,
                    'by_model': [],
                    'by_operation': [],
                }
            
            # Aggiungi cronologia recente
            from .models import ServiceUsageTracking
            try:
                recent_history = ServiceUsageTracking.objects.filter(
                    user_id=user_id,
                    service_name='learning'
                ).order_by('-created_at')[:10]
                
                recent_records = [
                    {
                        'id': usage.id,
                        'operation_type': usage.operation_type,
                        'model_used': usage.model_used,
                        'tokens_consumed': usage.tokens_consumed,
                        'cost_usd': float(usage.cost_usd) if usage.cost_usd else 0.0,
                        'cost_eur': float(usage.cost_eur) if usage.cost_eur else 0.0,
                        'success': usage.success,  # Campo critico per frontend
                        'response_time_ms': usage.response_time_ms,
                        'created_at': usage.created_at.isoformat(),
                        'input_data': usage.input_data[:100] + '...' if len(usage.input_data or '') > 100 else (usage.input_data or ''),
                    }
                    for usage in recent_history
                ]
                logger.info(f"✅ Recuperati {len(recent_records)} record recenti per user {user_id}")
            except Exception as history_error:
                logger.error(f"❌ Errore recupero cronologia per user {user_id}: {history_error}")
                recent_records = []
            
            response_data = {
                'summary': summary,
                'recent_records': recent_records,
                'period': period,
                'user_id': user_id
            }
            
            logger.info(f"🔄 Restituendo dati usage per user {user_id}: summary_keys={list(summary.keys())}, records_count={len(recent_records)}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching learning usage data: {str(e)}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 