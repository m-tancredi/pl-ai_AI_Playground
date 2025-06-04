import React from 'react';

const LoadingDots = () => {
    return (
        <div className="loading-dots flex items-center gap-1 p-4 bg-black text-white rounded-2xl mr-auto max-w-20 mb-4">
            <span 
                className="w-2 h-2 bg-white rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
            ></span>
            <span 
                className="w-2 h-2 bg-white rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
            ></span>
            <span 
                className="w-2 h-2 bg-white rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
            ></span>
        </div>
    );
};

export default LoadingDots; 