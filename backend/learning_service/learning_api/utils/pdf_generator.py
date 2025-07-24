import io
import os
from datetime import datetime
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
import weasyprint
from weasyprint import HTML, CSS
import logging

logger = logging.getLogger(__name__)

class LessonPDFGenerator:
    """
    Generatore PDF per lezioni del Learning Service.
    Supporta lezioni singole e multiple con contenuti completi.
    """
    
    def __init__(self):
        self.css_style = self._get_pdf_css()
    
    def _get_pdf_css(self):
        """CSS professionale per il PDF."""
        return """
        @page {
            size: A4;
            margin: 2cm 1.5cm;
            @top-center {
                content: "Learning Service - Fondazione Golinelli";
                font-family: 'Arial', sans-serif;
                font-size: 10px;
                color: #666;
            }
            @bottom-right {
                content: "Pagina " counter(page);
                font-family: 'Arial', sans-serif;
                font-size: 10px;
                color: #666;
            }
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        
        .lesson-header {
            border-bottom: 3px solid #ff1649;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .lesson-title {
            font-size: 28px;
            font-weight: bold;
            color: #ff1649;
            margin: 0 0 10px 0;
        }
        
        .lesson-meta {
            font-size: 14px;
            color: #666;
            margin: 5px 0;
        }
        
        .lesson-content {
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 40px;
            text-align: justify;
        }
        
        .lesson-content p {
            margin-bottom: 15px;
        }
        
        .section-title {
            font-size: 22px;
            font-weight: bold;
            color: #333;
            margin: 40px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .approfondimenti {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        
        .approfondimento-item {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        
        .approfondimento-title {
            font-size: 18px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        
        .approfondimento-content {
            font-size: 15px;
            line-height: 1.7;
        }
        
        .quiz-section {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 30px 0;
            border-radius: 5px;
        }
        
        .quiz-question {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        
        .question-number {
            font-weight: bold;
            color: #ffc107;
            font-size: 16px;
        }
        
        .question-text {
            font-size: 15px;
            font-weight: 500;
            margin: 8px 0 12px 0;
        }
        
        .quiz-options {
            margin-left: 20px;
        }
        
        .quiz-option {
            margin: 5px 0;
            font-size: 14px;
        }
        
        .correct-answer {
            font-weight: bold;
            color: #28a745;
        }
        
        .footer-info {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .depth-indicator {
            display: inline-block;
            background-color: #e9ecef;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            color: #495057;
        }
        
        .depth-1 { background-color: #d4edda; color: #155724; }
        .depth-2 { background-color: #fff3cd; color: #856404; }
        .depth-3 { background-color: #cce5ff; color: #004085; }
        .depth-4 { background-color: #f8d7da; color: #721c24; }
        .depth-5 { background-color: #e2e3e5; color: #383d41; }
        """
    
    def generate_single_lesson_pdf(self, lesson, include_approfondimenti=True, include_quiz=True):
        """
        Genera PDF per una singola lezione.
        
        Args:
            lesson: Oggetto Lesson del database
            include_approfondimenti: Include gli approfondimenti nel PDF
            include_quiz: Include il quiz nel PDF
            
        Returns:
            HttpResponse con il PDF
        """
        try:
            # Prepara i dati per il template
            context = {
                'lesson': lesson,
                'approfondimenti': lesson.approfondimenti.all() if include_approfondimenti else [],
                'quiz': lesson.quizzes.first() if include_quiz else None,
                'generation_date': datetime.now().strftime('%d/%m/%Y %H:%M'),
                'include_approfondimenti': include_approfondimenti,
                'include_quiz': include_quiz,
                'depth_level': getattr(lesson, 'depth_level', 3),
            }
            
            # Genera HTML dal template
            html_content = self._render_lesson_template(context)
            
            # Converti in PDF
            pdf_buffer = self._html_to_pdf(html_content)
            
            # Prepara response
            safe_title = lesson.title.replace(' ', '_').replace(':', '').replace('/', '_')
            filename = f"lezione_{lesson.id}_{safe_title}.pdf"
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            logger.info(f"PDF generato per lezione {lesson.id}: {filename}")
            return response
            
        except Exception as e:
            logger.error(f"Errore nella generazione PDF per lezione {lesson.id}: {str(e)}")
            raise Exception(f"Errore nella generazione del PDF: {str(e)}")
    
    def generate_bulk_lessons_pdf(self, lessons, filename_prefix="lezioni"):
        """
        Genera PDF per multiple lezioni.
        
        Args:
            lessons: Lista di oggetti Lesson
            filename_prefix: Prefisso per il nome del file
            
        Returns:
            HttpResponse con il PDF
        """
        try:
            if not lessons:
                raise ValueError("Nessuna lezione fornita per l'export")
            
            # Prepara i dati per il template
            context = {
                'lessons': lessons,
                'generation_date': datetime.now().strftime('%d/%m/%Y %H:%M'),
                'total_lessons': len(lessons),
            }
            
            # Genera HTML dal template
            html_content = self._render_bulk_template(context)
            
            # Converti in PDF
            pdf_buffer = self._html_to_pdf(html_content)
            
            # Prepara response
            filename = f"{filename_prefix}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            logger.info(f"PDF bulk generato per {len(lessons)} lezioni: {filename}")
            return response
            
        except Exception as e:
            logger.error(f"Errore nella generazione PDF bulk: {str(e)}")
            raise Exception(f"Errore nella generazione del PDF: {str(e)}")
    
    def _render_lesson_template(self, context):
        """Genera HTML per una singola lezione."""
        html_template = """
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>{{ lesson.title }}</title>
        </head>
        <body>
            <div class="lesson-header">
                <h1 class="lesson-title">{{ lesson.title }}</h1>
                <div class="lesson-meta">
                    <span class="depth-indicator depth-{{ depth_level }}">
                        Livello {{ depth_level }}/5
                    </span>
                    <span style="margin-left: 20px;">
                        Generato il: {{ generation_date }}
                    </span>
                </div>
            </div>
            
            <div class="lesson-content">
                {{ lesson.content|linebreaks }}
            </div>
            
            {% if include_approfondimenti and approfondimenti %}
            <div class="section-title">🔍 Approfondimenti</div>
            <div class="approfondimenti">
                {% for app in approfondimenti %}
                <div class="approfondimento-item">
                    <div class="approfondimento-title">{{ app.title }}</div>
                    <div class="approfondimento-content">
                        {{ app.content|linebreaks }}
                    </div>
                </div>
                {% endfor %}
            </div>
            {% endif %}
            
            {% if include_quiz and quiz %}
            <div class="page-break"></div>
            <div class="section-title">🎯 Quiz di Verifica</div>
            <div class="quiz-section">
                {% for question in quiz.questions %}
                <div class="quiz-question">
                    <div class="question-number">Domanda {{ forloop.counter }}:</div>
                    <div class="question-text">{{ question.question }}</div>
                    <div class="quiz-options">
                        {% for option in question.options %}
                        <div class="quiz-option {% if forloop.counter0 == question.correct_index %}correct-answer{% endif %}">
                            {{ forloop.counter }}. {{ option }}
                            {% if forloop.counter0 == question.correct_index %} ✓{% endif %}
                        </div>
                        {% endfor %}
                    </div>
                </div>
                {% endfor %}
            </div>
            {% endif %}
            
            <div class="footer-info">
                Documento generato automaticamente dal Learning Service - Fondazione Golinelli<br>
                Data di generazione: {{ generation_date }}
            </div>
        </body>
        </html>
        """
        
        from django.template import Template, Context
        template = Template(html_template)
        return template.render(Context(context))
    
    def _render_bulk_template(self, context):
        """Genera HTML per multiple lezioni."""
        html_template = """
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <title>Raccolta Lezioni</title>
        </head>
        <body>
            <div class="lesson-header">
                <h1 class="lesson-title">📚 Raccolta Lezioni</h1>
                <div class="lesson-meta">
                    <span>{{ total_lessons }} lezioni incluse</span>
                    <span style="margin-left: 20px;">
                        Generato il: {{ generation_date }}
                    </span>
                </div>
            </div>
            
            {% for lesson in lessons %}
            {% if not forloop.first %}<div class="page-break"></div>{% endif %}
            
            <div class="lesson-header">
                <h2 class="lesson-title">{{ forloop.counter }}. {{ lesson.title }}</h2>
                <div class="lesson-meta">
                    <span class="depth-indicator depth-{{ lesson.depth_level|default:3 }}">
                        Livello {{ lesson.depth_level|default:3 }}/5
                    </span>
                    <span style="margin-left: 20px;">
                        Creato il: {{ lesson.created_at|date:"d/m/Y H:i" }}
                    </span>
                </div>
            </div>
            
            <div class="lesson-content">
                {{ lesson.content|linebreaks }}
            </div>
            
            {% if lesson.approfondimenti.all %}
            <div class="section-title">🔍 Approfondimenti</div>
            <div class="approfondimenti">
                {% for app in lesson.approfondimenti.all %}
                <div class="approfondimento-item">
                    <div class="approfondimento-title">{{ app.title }}</div>
                    <div class="approfondimento-content">
                        {{ app.content|linebreaks }}
                    </div>
                </div>
                {% endfor %}
            </div>
            {% endif %}
            
            {% endfor %}
            
            <div class="footer-info">
                Documento generato automaticamente dal Learning Service - Fondazione Golinelli<br>
                Data di generazione: {{ generation_date }}
            </div>
        </body>
        </html>
        """
        
        from django.template import Template, Context
        template = Template(html_template)
        return template.render(Context(context))
    
    def _html_to_pdf(self, html_content):
        """Converte HTML in PDF usando WeasyPrint."""
        try:
            # Crea il PDF
            html_doc = HTML(string=html_content)
            css_doc = CSS(string=self.css_style)
            
            # Genera PDF in memoria
            pdf_buffer = io.BytesIO()
            html_doc.write_pdf(pdf_buffer, stylesheets=[css_doc])
            pdf_buffer.seek(0)
            
            return pdf_buffer
            
        except Exception as e:
            logger.error(f"Errore nella conversione HTML to PDF: {str(e)}")
            raise Exception(f"Errore nella generazione del PDF: {str(e)}")


# Istanza globale del generatore
pdf_generator = LessonPDFGenerator() 