import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useLearningService from '../../hooks/useLearningService';
import LoadingSpinner from '../LoadingSpinner';

const QuizSection = ({ quiz, lesson, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const { submitQuizAnswer, loading } = useLearningService();

  const questions = quiz?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Reset state when quiz changes
  useEffect(() => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSubmitted(false);
    setResults(null);
    setShowResults(false);
  }, [quiz?.id]);

  // Handle answer selection
  const handleAnswerSelect = (questionIndex, selectedAnswer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: selectedAnswer
    }));
  };

  // Navigate between questions
  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    try {
      // Calculate results
      let correctAnswers = 0;
      const detailedResults = questions.map((question, index) => {
        const userAnswer = userAnswers[index];
        // Convert letter to index for comparison (A=0, B=1, C=2, D=3)
        const userAnswerIndex = userAnswer ? userAnswer.charCodeAt(0) - 65 : -1;
        const correct = userAnswerIndex === question.correct_index;
        if (correct) correctAnswers++;
        
        return {
          question: question.question,
          userAnswer,
          correctAnswer: question.correct_index,
          correct,
          options: question.options
        };
      });

      const score = Math.round((correctAnswers / questions.length) * 100);

      // Submit each answer to backend
      for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
        const userAnswer = userAnswers[questionIndex];
        if (userAnswer !== undefined) {
          // Convert letter to index (A=0, B=1, C=2, D=3)
          const answerIndex = userAnswer.charCodeAt(0) - 65;
          
          await submitQuizAnswer({
            quiz: quiz.id,
            question_index: questionIndex,
            answer_index: answerIndex
          });
        }
      }

      setResults({
        score,
        correctAnswers,
        totalQuestions: questions.length,
        details: detailedResults
      });

      setSubmitted(true);
      setShowResults(true);
      
      toast.success(`Quiz completato! Punteggio: ${score}%`);
      
      // Mark lesson as completed if quiz passed
      if (score >= 70 && onComplete) {
        onComplete();
      }

    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Errore nell\'invio del quiz');
    }
  };

  // Answer option component
  const AnswerOption = ({ option, letter, selected, onClick, disabled, showCorrect, isCorrect }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full p-4 text-left border-2 rounded-lg transition-all
        ${disabled 
          ? showCorrect
            ? isCorrect 
              ? 'border-green-500 bg-green-50 text-green-800'
              : selected
                ? 'border-red-500 bg-red-50 text-red-800'
                : 'border-gray-200 bg-gray-50 text-gray-600'
            : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
          : selected
            ? 'border-[#ff1649] bg-[#ff1649]/10 text-[#ff1649]'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      <span className="flex items-center gap-3">
        <span className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
          ${disabled
            ? showCorrect
              ? isCorrect
                ? 'bg-green-500 text-white'
                : selected
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              : 'bg-gray-300 text-gray-600'
            : selected
              ? 'bg-[#ff1649] text-white'
              : 'bg-gray-200 text-gray-600'
          }
        `}>
          {letter}
        </span>
        <span className="flex-1">{option}</span>
        {disabled && showCorrect && isCorrect && (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        {disabled && showCorrect && selected && !isCorrect && (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    </button>
  );

  if (!quiz || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">Nessuna domanda disponibile per questo quiz</p>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults && results) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Results Header */}
          <div className="text-center mb-8">
            <div className={`
              w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold
              ${results.score >= 70 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}
            `}>
              {results.score}%
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Quiz Completato!
            </h2>
            <p className="text-gray-600">
              Hai risposto correttamente a {results.correctAnswers} su {results.totalQuestions} domande
            </p>
            {results.score >= 70 ? (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  🎉 Congratulazioni! Hai superato il quiz!
                </p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-800">
                  Punteggio insufficiente. Riprova studiando meglio la lezione.
                </p>
              </div>
            )}
          </div>

          {/* Detailed Results */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Riepilogo risposte
            </h3>
            
            {results.details.map((item, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0
                    ${item.correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                  `}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 mb-3">
                      {item.question}
                    </h4>
                    
                    <div className="space-y-2">
                      {item.options.map((option, optIndex) => {
                        const letter = String.fromCharCode(65 + optIndex);
                        const isUserAnswer = item.userAnswer === letter;
                        const isCorrectAnswer = optIndex === item.correctAnswer;
                        
                        return (
                          <div
                            key={optIndex}
                            className={`
                              p-3 rounded-lg border
                              ${isCorrectAnswer
                                ? 'border-green-500 bg-green-50'
                                : isUserAnswer && !isCorrectAnswer
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-200 bg-gray-50'
                              }
                            `}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                                ${isCorrectAnswer
                                  ? 'bg-green-500 text-white'
                                  : isUserAnswer && !isCorrectAnswer
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-300 text-gray-600'
                                }
                              `}>
                                {letter}
                              </span>
                              <span className={
                                isCorrectAnswer ? 'text-green-800' :
                                isUserAnswer && !isCorrectAnswer ? 'text-red-800' :
                                'text-gray-600'
                              }>
                                {option}
                              </span>
                              {isCorrectAnswer && (
                                <span className="ml-auto text-green-600 text-sm font-medium">
                                  ✓ Corretta
                                </span>
                              )}
                              {isUserAnswer && !isCorrectAnswer && (
                                <span className="ml-auto text-red-600 text-sm">
                                  La tua risposta
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => {
                setShowResults(false);
                setSubmitted(false);
                setCurrentQuestionIndex(0);
                setUserAnswers({});
              }}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Riprova Quiz
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-[#ff1649] hover:bg-[#e01440] text-white rounded-lg transition-colors"
            >
              Torna alla Lezione
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz taking view
  return (
    <div className="flex flex-col h-full">
      {/* Progress Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Quiz: {lesson.title}
            </h2>
            <span className="text-sm text-gray-500">
              Domanda {currentQuestionIndex + 1} di {questions.length}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#ff1649] h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {currentQuestion && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-6">
                {currentQuestion.question}
              </h3>
              
              <div className="space-y-3 mb-8">
                {currentQuestion.options.map((option, index) => {
                  const letter = String.fromCharCode(65 + index);
                  const selected = userAnswers[currentQuestionIndex] === letter;
                  
                  return (
                    <AnswerOption
                      key={index}
                      option={option}
                      letter={letter}
                      selected={selected}
                      onClick={() => handleAnswerSelect(currentQuestionIndex, letter)}
                      disabled={submitted}
                      showCorrect={submitted}
                      isCorrect={index === currentQuestion.correct_index}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-gray-200 bg-white p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            ← Precedente
          </button>

          <div className="flex items-center gap-2">
            {/* Answer indicator dots */}
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`
                  w-3 h-3 rounded-full transition-all
                  ${index === currentQuestionIndex
                    ? 'bg-[#ff1649]'
                    : userAnswers[index]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }
                  ${index < currentQuestionIndex ? 'hover:bg-green-600' : 'hover:bg-gray-400'}
                `}
                title={`Domanda ${index + 1}${userAnswers[index] ? ' (risposta data)' : ''}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-[#ff1649] hover:bg-[#e01440] text-white rounded-lg transition-colors"
              >
                Avanti →
              </button>
            ) : (
              <button
                onClick={handleSubmitQuiz}
                disabled={Object.keys(userAnswers).length < questions.length || loading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="small" color="white" />
                    Invio...
                  </>
                ) : (
                  'Completa Quiz'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizSection; 