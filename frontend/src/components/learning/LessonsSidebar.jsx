import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

const LessonsSidebar = ({
  lessons,
  currentLesson,
  onSelectLesson,
  onDeleteLesson,
  onDeleteAllLessons,
  loading
}) => {
  // Status icon component
  const StatusIcon = ({ status }) => {
    if (status === 'completed') {
      return (
        <div className="w-3 h-3 bg-green-500 rounded-full" title="Completata" />
      );
    }
    return (
      <div className="w-3 h-3 bg-orange-500 rounded-full" title="In corso" />
    );
  };

  // Delete button component
  const DeleteButton = ({ onClick, title = "Elimina" }) => (
    <button
      onClick={onClick}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
      title={title}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </button>
  );

  return (
    <aside className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Lezioni salvate
          </h2>
          {lessons.length > 0 && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {lessons.length}
            </span>
          )}
        </div>
        
        {/* Delete All Button */}
        {lessons.length > 0 && (
          <button
            onClick={onDeleteAllLessons}
            className="mt-3 w-full text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-md border border-red-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Elimina tutte
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && lessons.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="medium" text="Caricamento lezioni..." />
          </div>
        ) : lessons.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="mb-4">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">Nessuna lezione salvata</p>
            <p className="text-sm text-gray-500">
              Genera la tua prima lezione per iniziare!
            </p>
          </div>
        ) : (
          <div className="p-2">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className={`
                  group relative mb-2 p-3 rounded-lg cursor-pointer border transition-all
                  ${currentLesson && currentLesson.id === lesson.id
                    ? 'bg-[#ff1649] text-white border-[#ff1649] shadow-md'
                    : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => onSelectLesson(lesson)}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <StatusIcon status={lesson.status} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`
                      font-medium text-sm line-clamp-2 mb-1
                      ${currentLesson && currentLesson.id === lesson.id
                        ? 'text-white'
                        : 'text-gray-800'
                      }
                    `}>
                      {lesson.title}
                    </h3>
                    
                    {/* Metadata */}
                    <div className={`
                      flex items-center gap-3 text-xs
                      ${currentLesson && currentLesson.id === lesson.id
                        ? 'text-white/80'
                        : 'text-gray-500'
                      }
                    `}>
                      <span>
                        {new Date(lesson.created_at).toLocaleDateString('it-IT')}
                      </span>
                      {lesson.quiz_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Quiz
                        </span>
                      )}
                      {lesson.approfondimenti_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                          </svg>
                          {lesson.approfondimenti_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <div 
                    className={`
                      flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                      ${currentLesson && currentLesson.id === lesson.id ? 'opacity-100' : ''}
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLesson(lesson.id, lesson.title);
                    }}
                  >
                    <DeleteButton />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {lessons.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {lessons.filter(l => l.status === 'completed').length} completate
            </span>
            <span>
              {lessons.filter(l => l.status === 'in_progress').length} in corso
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};

export default LessonsSidebar; 