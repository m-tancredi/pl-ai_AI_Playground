import { useState, useEffect, useRef, useCallback } from 'react';

export const useTypewriter = (text, options = {}) => {
    const {
        speed = 50,                    // ms per carattere
        pauseOnPunctuation = 200,      // pausa extra su punteggiatura
        skipAnimation: shouldSkipAnimation = false,         // salta animazione
        onComplete = () => {},         // callback completamento
        onStart = () => {},           // callback inizio
        enabled = true,               // abilita/disabilita effetto
        autoSkipLong = true,          // skip automatico per testi lunghi
        maxLength = 500               // lunghezza massima prima di auto-skip
    } = options;

    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    
    const timeoutRef = useRef(null);
    const rafRef = useRef(null);
    const startTimeRef = useRef(null);
    const pausedTimeRef = useRef(0);

    // Funzione per determinare la velocità basata sul carattere
    const getCharacterSpeed = useCallback((char, nextChar) => {
        // Codice o caratteri speciali
        if (/[{}[\]()=+\-*/<>]/.test(char)) return speed * 0.6;
        
        // Numeri
        if (/\d/.test(char)) return speed * 0.8;
        
        // Punteggiatura con pausa extra
        if (/[.!?]/.test(char)) return speed + pauseOnPunctuation;
        if (/[,;:]/.test(char)) return speed + (pauseOnPunctuation * 0.5);
        
        // Spazi dopo punteggiatura
        if (char === ' ' && /[.!?]/.test(displayText.slice(-1))) {
            return speed + (pauseOnPunctuation * 0.3);
        }
        
        // Caratteri normali
        return speed;
    }, [speed, pauseOnPunctuation, displayText]);

    // Funzione per chunking intelligente del testo
    const getSmartChunks = useCallback((text) => {
        const chunks = [];
        let currentChunk = '';
        let inCodeBlock = false;
        let inInlineCode = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            const prevChar = text[i - 1];
            
            // Gestione code blocks
            if (char === '`' && nextChar === '`' && text[i + 2] === '`') {
                inCodeBlock = !inCodeBlock;
                currentChunk += char;
                continue;
            }
            
            // Gestione inline code
            if (char === '`' && !inCodeBlock) {
                inInlineCode = !inInlineCode;
            }
            
            currentChunk += char;
            
            // Punti di interruzione naturali
            const isNaturalBreak = (
                (char === ' ' && currentChunk.length > 10) ||
                (char === '\n') ||
                (char === '.' && nextChar === ' ') ||
                (char === '!' && nextChar === ' ') ||
                (char === '?' && nextChar === ' ')
            ) && !inCodeBlock && !inInlineCode;
            
            if (isNaturalBreak || currentChunk.length > 50) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
        }
        
        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    }, []);

    // Funzione principale di typing
    const typeNextCharacter = useCallback(() => {
        if (!text || currentIndex >= text.length || isPaused) return;
        
        const char = text[currentIndex];
        const nextChar = text[currentIndex + 1];
        
        setDisplayText(prev => prev + char);
        setCurrentIndex(prev => prev + 1);
        
        // Se abbiamo finito
        if (currentIndex + 1 >= text.length) {
            setIsTyping(false);
            setIsComplete(true);
            onComplete();
            return;
        }
        
        // Calcola velocità per il prossimo carattere
        const nextSpeed = getCharacterSpeed(char, nextChar);
        
        // Programma il prossimo carattere
        timeoutRef.current = setTimeout(() => {
            rafRef.current = requestAnimationFrame(typeNextCharacter);
        }, nextSpeed);
        
    }, [text, currentIndex, isPaused, getCharacterSpeed, onComplete]);

    // Funzione per skippare l'animazione
    const skipTypewriter = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        
        setDisplayText(text);
        setCurrentIndex(text.length);
        setIsTyping(false);
        setIsComplete(true);
        onComplete();
    }, [text, onComplete]);

    // Funzione per pausare/riprendere
    const togglePause = useCallback(() => {
        setIsPaused(prev => !prev);
        if (isPaused) {
            // Riprendi
            rafRef.current = requestAnimationFrame(typeNextCharacter);
        } else {
            // Pausa
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
    }, [isPaused, typeNextCharacter]);

    // Funzione per riavviare l'animazione
    const restartAnimation = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        
        setDisplayText('');
        setCurrentIndex(0);
        setIsComplete(false);
        setIsPaused(false);
        setIsTyping(true);
        
        onStart();
        
        // Avvia dopo un piccolo delay
        setTimeout(() => {
            rafRef.current = requestAnimationFrame(typeNextCharacter);
        }, 100);
    }, [onStart, typeNextCharacter]);

    // Effetto principale
    useEffect(() => {
        if (!text || !enabled || shouldSkipAnimation) {
            setDisplayText(text);
            setIsComplete(true);
            setIsTyping(false);
            return;
        }

        // Auto-skip per testi lunghi
        if (autoSkipLong && text.length > maxLength) {
            setDisplayText(text);
            setIsComplete(true);
            setIsTyping(false);
            return;
        }

        // Reset stati
        setDisplayText('');
        setCurrentIndex(0);
        setIsComplete(false);
        setIsPaused(false);
        setIsTyping(true);
        startTimeRef.current = Date.now();
        
        onStart();
        
        // Avvia l'animazione
        const startTimeout = setTimeout(() => {
            rafRef.current = requestAnimationFrame(typeNextCharacter);
        }, 100);

        return () => {
            clearTimeout(startTimeout);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [text, enabled, shouldSkipAnimation, autoSkipLong, maxLength, onStart, typeNextCharacter]);

    // Gestione accessibilità - rispetta prefers-reduced-motion
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleChange = () => {
            if (mediaQuery.matches && isTyping) {
                skipTypewriter();
            }
        };
        
        mediaQuery.addListener(handleChange);
        handleChange(); // Check iniziale
        
        return () => mediaQuery.removeListener(handleChange);
    }, [isTyping, skipTypewriter]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Calcola statistiche
    const progress = text ? (currentIndex / text.length) * 100 : 0;
    const estimatedTimeLeft = text && isTyping ? 
        ((text.length - currentIndex) * speed) / 1000 : 0;
    
    const wordsPerMinute = startTimeRef.current && currentIndex > 0 ? 
        (currentIndex / ((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000)) * 60 / 5 : 0;

    return {
        // Stati principali
        displayText,
        isTyping,
        isComplete,
        isPaused,
        
        // Controlli
        skipAnimation: skipTypewriter,
        togglePause,
        restartAnimation,
        
        // Statistiche
        progress,
        currentIndex,
        totalLength: text?.length || 0,
        estimatedTimeLeft,
        wordsPerMinute: Math.round(wordsPerMinute),
        
        // Utility
        canSkip: isTyping && !isComplete,
        canPause: isTyping && !isComplete,
        canRestart: isComplete
    };
}; 