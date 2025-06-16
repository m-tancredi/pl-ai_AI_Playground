import React from 'react';
import { TrashIcon, DocumentIcon } from '@heroicons/react/24/outline';

const DocumentItem = ({ document, onDelete }) => {
    const getFileIcon = (fileType) => {
        switch (fileType?.toLowerCase()) {
            case 'pdf':
                return '📄';
            case 'doc':
            case 'docx':
                return '📝';
            case 'txt':
                return '📋';
            case 'csv':
            case 'xlsx':
            case 'xls':
                return '📊';
            default:
                return '📎';
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'processing':
                return 'bg-blue-100 text-blue-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-4">
                <div className="text-2xl">
                    {getFileIcon(document.file_type)}
                </div>
                <div>
                    <h3 className="text-sm font-medium text-gray-900">
                        {document.filename}
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>•</span>
                        <span>{new Date(document.uploaded_at).toLocaleDateString()}</span>
                        {document.status && (
                            <>
                                <span>•</span>
                                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(document.status)}`}>
                                    {document.status}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <button
                onClick={() => onDelete(document.id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Elimina documento"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default DocumentItem; 