from rest_framework import serializers
from .models import (
    Lesson, 
    Quiz, 
    QuizAnswer, 
    Approfondimento, 
    ActivityLog, 
    UserProgress
)


class LessonSerializer(serializers.ModelSerializer):
    """Serializer completo per le lezioni."""
    quiz_count = serializers.ReadOnlyField()
    approfondimenti_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Lesson
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'user_id')


class LessonCreateSerializer(serializers.ModelSerializer):
    """Serializer per la creazione di lezioni."""
    
    class Meta:
        model = Lesson
        fields = ('title', 'content', 'lesson_length')
    
    def validate_title(self, value):
        """Validazione del titolo della lezione."""
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Il titolo deve avere almeno 3 caratteri")
        return value.strip()
    
    def create(self, validated_data):
        """Crea una nuova lezione con user_id dal context."""
        validated_data['user_id'] = self.context['request'].user.id
        return super().create(validated_data)


class LessonUpdateSerializer(serializers.ModelSerializer):
    """Serializer per l'aggiornamento di lezioni."""
    
    class Meta:
        model = Lesson
        fields = ('title', 'content', 'status')


class LessonListSerializer(serializers.ModelSerializer):
    """Serializer per la lista delle lezioni (vista semplificata)."""
    quiz_count = serializers.ReadOnlyField()
    approfondimenti_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Lesson
        fields = (
            'id', 
            'title', 
            'status', 
            'created_at',
            'quiz_count',
            'approfondimenti_count'
        )


class QuizSerializer(serializers.ModelSerializer):
    """Serializer per i quiz."""
    
    class Meta:
        model = Quiz
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'total_questions')


class QuizCreateSerializer(serializers.ModelSerializer):
    """Serializer per la creazione di quiz."""
    
    class Meta:
        model = Quiz
        fields = ('lesson', 'questions')
    
    def validate_questions(self, value):
        """Validazione delle domande del quiz."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Le domande devono essere una lista")
        
        if len(value) == 0:
            raise serializers.ValidationError("Il quiz deve contenere almeno una domanda")
        
        for i, question in enumerate(value):
            if not isinstance(question, dict):
                raise serializers.ValidationError(f"La domanda {i+1} deve essere un oggetto")
            
            required_fields = ['question', 'options', 'correct_index']
            for field in required_fields:
                if field not in question:
                    raise serializers.ValidationError(f"La domanda {i+1} manca del campo '{field}'")
            
            if not isinstance(question['options'], list) or len(question['options']) != 4:
                raise serializers.ValidationError(f"La domanda {i+1} deve avere esattamente 4 opzioni")
            
            if not isinstance(question['correct_index'], int) or not (0 <= question['correct_index'] <= 3):
                raise serializers.ValidationError(f"La domanda {i+1} ha un indice di risposta corretta non valido")
        
        return value


class QuizAnswerSerializer(serializers.ModelSerializer):
    """Serializer per le risposte ai quiz."""
    
    class Meta:
        model = QuizAnswer
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'user_id', 'is_correct', 'answered_at')


class QuizAnswerCreateSerializer(serializers.ModelSerializer):
    """Serializer per la creazione di risposte ai quiz."""
    
    class Meta:
        model = QuizAnswer
        fields = ('quiz', 'question_index', 'answer_index')
    
    def validate(self, data):
        """Validazione della risposta al quiz."""
        quiz = data['quiz']
        question_index = data['question_index']
        answer_index = data['answer_index']
        
        # Verifica che l'indice della domanda sia valido
        if question_index < 0 or question_index >= quiz.total_questions:
            raise serializers.ValidationError("Indice della domanda non valido")
        
        # Verifica che l'indice della risposta sia valido
        if answer_index < 0 or answer_index > 3:
            raise serializers.ValidationError("Indice della risposta non valido")
        
        return data
    
    def create(self, validated_data):
        """Crea una risposta al quiz con controllo correttezza."""
        quiz = validated_data['quiz']
        question_index = validated_data['question_index']
        answer_index = validated_data['answer_index']
        
        # Verifica se la risposta è corretta
        if quiz.questions and question_index < len(quiz.questions):
            question = quiz.questions[question_index]
            is_correct = answer_index == question.get('correct_index', -1)
        else:
            is_correct = False
        
        validated_data['user_id'] = self.context['request'].user.id
        validated_data['is_correct'] = is_correct
        
        return super().create(validated_data)


class ApprofondimentoSerializer(serializers.ModelSerializer):
    """Serializer per gli approfondimenti."""
    
    class Meta:
        model = Approfondimento
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class ApprofondimentoCreateSerializer(serializers.ModelSerializer):
    """Serializer per la creazione di approfondimenti."""
    
    class Meta:
        model = Approfondimento
        fields = ('lesson', 'title', 'content', 'order')
    
    def validate_title(self, value):
        """Validazione del titolo dell'approfondimento."""
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Il titolo deve avere almeno 3 caratteri")
        return value.strip()


class ApprofondimentoUpdateSerializer(serializers.ModelSerializer):
    """Serializer per l'aggiornamento di approfondimenti."""
    
    class Meta:
        model = Approfondimento
        fields = ('title', 'content', 'detailed_content', 'is_detailed', 'order')


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer per i log delle attività."""
    
    class Meta:
        model = ActivityLog
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class UserProgressSerializer(serializers.ModelSerializer):
    """Serializer per il progresso utente."""
    completion_rate = serializers.ReadOnlyField()
    quiz_accuracy = serializers.ReadOnlyField()
    
    class Meta:
        model = UserProgress
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'user_id')


# Serializers per le API specifiche del learning service

class LessonGenerateSerializer(serializers.Serializer):
    """Serializer per la richiesta di generazione lezione."""
    topic = serializers.CharField(max_length=500, help_text="Argomento della lezione")
    lesson_length = serializers.IntegerField(
        required=False, 
        min_value=5, 
        max_value=50,
        help_text="Lunghezza in righe (opzionale)"
    )
    depth_level = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=5,
        default=3,
        help_text="Livello di approfondimento (1-5)"
    )
    model = serializers.CharField(
        required=False,
        max_length=50,
        default='gpt-3.5-turbo',
        help_text="Modello AI da utilizzare"
    )
    
    def validate_topic(self, value):
        """Validazione del topic."""
        topic = value.strip()
        if len(topic) < 3:
            raise serializers.ValidationError("L'argomento deve avere almeno 3 caratteri")
        return topic


class QuizGenerateSerializer(serializers.Serializer):
    """Serializer per la richiesta di generazione quiz."""
    lesson_id = serializers.UUIDField(help_text="ID della lezione")
    num_questions = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=20,
        help_text="Numero di domande (opzionale)"
    )
    difficulty_level = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=5,
        default=3,
        help_text="Livello di difficoltà (1-5)"
    )
    include_approfondimenti = serializers.BooleanField(
        default=True,
        help_text="Includere gli approfondimenti nel quiz"
    )
    model = serializers.CharField(
        required=False,
        max_length=50,
        default='gpt-3.5-turbo',
        help_text="Modello AI da utilizzare"
    )


class ApprofondimentiGenerateSerializer(serializers.Serializer):
    """Serializer per la richiesta di generazione approfondimenti."""
    lesson_id = serializers.UUIDField(help_text="ID della lezione")
    max_items = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=10,
        help_text="Numero massimo di approfondimenti"
    )
    depth_level = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=5,
        default=3,
        help_text="Livello di dettaglio (1-5, eredita dalla lezione)"
    )
    existing_approfondimenti = serializers.ListField(
        required=False,
        child=serializers.DictField(),
        help_text="Lista approfondimenti esistenti per anti-duplicazione"
    )
    model = serializers.CharField(
        required=False,
        max_length=50,
        default='gpt-3.5-turbo',
        help_text="Modello AI da utilizzare"
    )


class DetailedApprofondimentoGenerateSerializer(serializers.Serializer):
    """Serializer per la richiesta di generazione approfondimento dettagliato."""
    approfondimento_id = serializers.UUIDField(help_text="ID dell'approfondimento")
    model = serializers.CharField(
        required=False,
        max_length=50,
        default='gpt-3.5-turbo',
        help_text="Modello AI da utilizzare"
    )


class LessonWithRelatedSerializer(serializers.ModelSerializer):
    """Serializer per lezione con dati correlati."""
    quizzes = QuizSerializer(many=True, read_only=True)
    approfondimenti = ApprofondimentoSerializer(many=True, read_only=True)
    quiz_count = serializers.ReadOnlyField()
    approfondimenti_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Lesson
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'user_id') 