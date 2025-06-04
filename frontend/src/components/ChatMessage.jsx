import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

const ChatMessage = ({ role, content, model }) => {
    const isUser = role === 'user';
    
    return (
        <div className={`message flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                isUser 
                    ? 'bg-gray-100 text-gray-800 ml-auto' 
                    : 'bg-black text-white mr-auto'
            }`}>
                {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{content}</div>
                ) : (
                    <ReactMarkdown
                        components={{
                            code({node, inline, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                    <SyntaxHighlighter
                                        style={tomorrow}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-lg"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={`${className} bg-gray-800 px-1 py-0.5 rounded text-sm`} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                            h1: ({children}) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
                            h2: ({children}) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
                            h3: ({children}) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
                            p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                            ul: ({children}) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                            li: ({children}) => <li className="mb-1">{children}</li>,
                            blockquote: ({children}) => (
                                <blockquote className="border-l-4 border-gray-300 pl-4 my-4 italic">
                                    {children}
                                </blockquote>
                            ),
                            a: ({children, href}) => (
                                <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                                    {children}
                                </a>
                            ),
                        }}
                        className="markdown-content"
                    >
                        {content}
                    </ReactMarkdown>
                )}
                {model && !isUser && (
                    <div className="text-xs text-gray-400 mt-2 opacity-70">
                        Model: {model}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage; 