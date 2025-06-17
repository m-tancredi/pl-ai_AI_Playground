import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTypewriter } from '../hooks/useTypewriter';
import { 
    PlayIcon, 
    PauseIcon, 
    ForwardIcon,
    ArrowPathIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon
} from '@heroicons/react/24/outline';

const TypewriterText = ({ 
    text, 
    speed = 50,
    onComplete = () => {},
    onStart = () => {},
    showCursor = true,
    enableSkip = true,
    enableControls = false,
    className = '',
    cursorStyle = 'classic', // 'classic', 'block', 'underscore'
    soundEnabled = false
}) => {
    const [showControls, setShowControls] = useState(false);
    const [userSettings, setUserSettings] = useState({
        speed: speed,
        soundEnabled: soundEnabled,
        autoSkipLong: true
    });
    const [fallbackMode, setFallbackMode] = useState(false);

    const {
        displayText,
        isTyping,
        isComplete,
        isPaused,
        skipAnimation,
        togglePause,
        restartAnimation,
        progress,
        currentIndex,
        totalLength,
        estimatedTimeLeft,
        wordsPerMinute,
        canSkip,
        canPause,
        canRestart
    } = useTypewriter(text, {
        speed: userSettings.speed,
        onComplete: () => {
            onComplete();
            if (userSettings.soundEnabled) {
                playCompletionSound();
            }
        },
        onStart: () => {
            onStart();
            if (userSettings.soundEnabled) {
                playStartSound();
            }
        },
        autoSkipLong: userSettings.autoSkipLong
    });

    // Fallback di sicurezza: se dopo 2 secondi non è iniziato il typing, mostra tutto il testo
    useEffect(() => {
        if (!text) return;
        
        // Reset fallback per nuovo testo
        setFallbackMode(false);
        
        const fallbackTimer = setTimeout(() => {
            if (!isTyping && !isComplete && !displayText) {
                console.warn('Typewriter fallback attivato per:', text.substring(0, 50));
                setFallbackMode(true);
            }
        }, 2000);

        return () => clearTimeout(fallbackTimer);
    }, [text, isTyping, isComplete, displayText]);

    // Cursor styles
    const getCursorElement = () => {
        const cursorClasses = "inline-block animate-pulse";
        
        switch (cursorStyle) {
            case 'block':
                return <span className={`${cursorClasses} bg-current w-2 h-4 ml-0.5`}>█</span>;
            case 'underscore':
                return <span className={`${cursorClasses} border-b-2 border-current ml-0.5 w-2 h-4`}>_</span>;
            case 'classic':
            default:
                return <span className={`${cursorClasses} text-current ml-0.5`}>|</span>;
        }
    };

    // Sound effects (opzionali)
    const playTypingSound = () => {
        if (!userSettings.soundEnabled) return;
        // Implementare suoni di typing se necessario
        const audio = new Audio('/sounds/type.mp3');
        audio.volume = 0.1;
        audio.play().catch(() => {}); // Ignora errori audio
    };

    const playCompletionSound = () => {
        if (!userSettings.soundEnabled) return;
        const audio = new Audio('/sounds/complete.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
    };

    const playStartSound = () => {
        if (!userSettings.soundEnabled) return;
        const audio = new Audio('/sounds/start.mp3');
        audio.volume = 0.1;
        audio.play().catch(() => {});
    };

    // Gestione click per skip
    const handleClick = (e) => {
        if (!enableSkip || !canSkip) return;
        
        e.preventDefault();
        e.stopPropagation();
        skipAnimation();
    };

    // Gestione hover per controlli
    const handleMouseEnter = () => {
        if (enableControls) {
            setShowControls(true);
        }
    };

    const handleMouseLeave = () => {
        if (enableControls) {
            setShowControls(false);
        }
    };

    // Gestione keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!isTyping && !canRestart) return;
            
            switch (e.key) {
                case ' ':
                    if (canSkip) {
                        e.preventDefault();
                        skipAnimation();
                    }
                    break;
                case 'Escape':
                    if (canSkip) {
                        e.preventDefault();
                        skipAnimation();
                    }
                    break;
                case 'p':
                    if (canPause && e.ctrlKey) {
                        e.preventDefault();
                        togglePause();
                    }
                    break;
                case 'r':
                    if (canRestart && e.ctrlKey) {
                        e.preventDefault();
                        restartAnimation();
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [isTyping, canSkip, canPause, canRestart, skipAnimation, togglePause, restartAnimation]);

    return (
        <div 
            className={`relative group ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: canSkip ? 'pointer' : 'default' }}
        >
            {/* Contenuto principale */}
            <div className="prose prose-sm max-w-none">
                <ReactMarkdown>
                    {fallbackMode ? text : displayText}
                    {showCursor && isTyping && !fallbackMode && getCursorElement()}
                </ReactMarkdown>
            </div>

            {/* Indicatore di skip */}
            {canSkip && enableSkip && (
                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded-bl-lg">
                        Click per completare
                    </div>
                </div>
            )}

            {/* Progress bar sottile */}
            {isTyping && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-100 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Controlli avanzati */}
            {enableControls && showControls && (isTyping || canRestart) && (
                <div className="absolute top-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex items-center space-x-2 z-10">
                    {/* Play/Pause */}
                    {canPause && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                togglePause();
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title={isPaused ? 'Riprendi' : 'Pausa'}
                        >
                            {isPaused ? 
                                <PlayIcon className="w-4 h-4 text-green-600" /> : 
                                <PauseIcon className="w-4 h-4 text-yellow-600" />
                            }
                        </button>
                    )}

                    {/* Skip */}
                    {canSkip && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                skipAnimation();
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Salta animazione"
                        >
                            <ForwardIcon className="w-4 h-4 text-blue-600" />
                        </button>
                    )}

                    {/* Restart */}
                    {canRestart && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                restartAnimation();
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Riavvia animazione"
                        >
                            <ArrowPathIcon className="w-4 h-4 text-purple-600" />
                        </button>
                    )}

                    {/* Sound toggle */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setUserSettings(prev => ({
                                ...prev,
                                soundEnabled: !prev.soundEnabled
                            }));
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title={userSettings.soundEnabled ? 'Disabilita suoni' : 'Abilita suoni'}
                    >
                        {userSettings.soundEnabled ? 
                            <SpeakerWaveIcon className="w-4 h-4 text-green-600" /> : 
                            <SpeakerXMarkIcon className="w-4 h-4 text-gray-400" />
                        }
                    </button>

                    {/* Speed control */}
                    <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-600">Velocità:</span>
                        <select
                            value={userSettings.speed}
                            onChange={(e) => setUserSettings(prev => ({
                                ...prev,
                                speed: parseInt(e.target.value)
                            }))}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <option value={20}>Veloce</option>
                            <option value={50}>Normale</option>
                            <option value={100}>Lenta</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Statistiche (solo in modalità debug) */}
            {process.env.NODE_ENV === 'development' && isTyping && (
                <div className="absolute bottom-6 right-0 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded-l-lg">
                    <div>Progresso: {Math.round(progress)}%</div>
                    <div>Caratteri: {currentIndex}/{totalLength}</div>
                    <div>Tempo stimato: {Math.round(estimatedTimeLeft)}s</div>
                    <div>WPM: {wordsPerMinute}</div>
                </div>
            )}

            {/* Thinking indicator prima dell'inizio */}
            {!isTyping && !isComplete && text && (
                <div className="flex items-center space-x-2 text-gray-500">
                    <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm">AI sta scrivendo...</span>
                </div>
            )}
        </div>
    );
};

export default TypewriterText; 