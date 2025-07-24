import { useState, useEffect, useRef } from 'react';

export const useTypewriter = (text, options = {}) => {
    const {
        speed = 50,
        pauseOnPunctuation = 200,
        enabled = true,
        skipAnimation = false,
        autoSkipLong = false,
        maxLength = 1000,
        onComplete = null
    } = options;

    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const timeoutRef = useRef(null);
    const indexRef = useRef(0);

    useEffect(() => {
        // Reset states when text changes
        setDisplayText('');
        setIsTyping(false);
        setIsComplete(false);
        indexRef.current = 0;

        if (!text || !enabled || skipAnimation) {
            setDisplayText(text || '');
            setIsComplete(true);
            if (onComplete) onComplete();
            return;
        }

        // Auto skip for long text
        if (autoSkipLong && text.length > maxLength) {
            setDisplayText(text);
            setIsComplete(true);
            if (onComplete) onComplete();
            return;
        }

        setIsTyping(true);

        const typeNextChar = () => {
            if (indexRef.current < text.length) {
                const nextChar = text[indexRef.current];
                setDisplayText(text.substring(0, indexRef.current + 1));
                indexRef.current++;

                // Determine delay for next character
                let delay = speed;
                if (pauseOnPunctuation > 0 && /[.!?,:;]/.test(nextChar)) {
                    delay += pauseOnPunctuation;
                }

                timeoutRef.current = setTimeout(typeNextChar, delay);
            } else {
                // Animation complete
                setIsTyping(false);
                setIsComplete(true);
                if (onComplete) onComplete();
            }
        };

        // Start typing animation
        timeoutRef.current = setTimeout(typeNextChar, speed);

        // Cleanup function
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [text, speed, pauseOnPunctuation, enabled, skipAnimation, autoSkipLong, maxLength, onComplete]);

    // Skip animation function
    const skipAnimation = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setDisplayText(text || '');
        setIsTyping(false);
        setIsComplete(true);
        if (onComplete) onComplete();
    };

    return {
        displayText,
        isTyping,
        isComplete,
        skipAnimation
    };
}; 