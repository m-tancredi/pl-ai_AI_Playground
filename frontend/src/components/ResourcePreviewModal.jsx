import React, { useState, useEffect } from 'react';
import { FaTimes, FaDownload, FaSave, FaSpinner, FaFileImage, FaFilePdf, FaFileAlt, FaFileCsv, FaEye } from 'react-icons/fa';
import Papa from 'papaparse';
import { getFullMediaUrl } from '../utils/getFullMediaUrl';

// Componenti UI moderni - stile chatbot
const Spinner = () => <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>;
const Alert = ({ message }) => message ? <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-4 border border-red-200 text-sm font-medium">{message}</div> : null;

const ResourcePreviewModal = ({ isOpen, onClose, resource, onSave, onDownload }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvChanged, setCsvChanged] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textChanged, setTextChanged] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!isOpen || !resource) return;
    setError('');
    setCsvData([]); setCsvHeaders([]); setCsvChanged(false);
    setTextContent(''); setTextChanged(false);
    const url = getFullMediaUrl(resource.file_url || resource.download_url);
    console.log('Resource preview URL:', url);
    if (resource.mime_type === 'text/csv') {
      setLoading(true);
      fetch(url)
        .then(res => res.text())
        .then(text => {
          const parsed = Papa.parse(text, { header: true, preview: 50 });
          setCsvHeaders(parsed.meta.fields || []);
          setCsvData(parsed.data || []);
        })
        .catch(() => setError('Errore nel caricamento del CSV'))
        .finally(() => setLoading(false));
    } else if (resource.mime_type?.startsWith('text/')) {
      setLoading(true);
      fetch(url)
        .then(res => res.text())
        .then(setTextContent)
        .catch(() => setError('Errore nel caricamento del file di testo'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isOpen, resource]);

  const handleCsvCellEdit = (rowIdx, header, value) => {
    setCsvData(prev => prev.map((row, i) => i === rowIdx ? { ...row, [header]: value } : row));
    setCsvChanged(true);
  };
  const handleSaveCsv = () => {
    if (!csvHeaders.length || !csvData.length) return;
    const csvString = Papa.unparse(csvData, { columns: csvHeaders });
    onSave(resource.id, csvString);
    setCsvChanged(false);
  };
  const handleSaveText = () => {
    onSave(resource.id, textContent);
    setTextChanged(false);
  };

  // Funzione di download con fallback
  const handleDownload = () => {
    setDownloadError('');
    try {
      if (onDownload) {
        onDownload(resource);
      } else {
        window.open(previewUrl, '_blank');
      }
    } catch (err) {
      setDownloadError('Errore durante il download. Prova il link diretto.');
    }
  };

  if (!isOpen || !resource) return null;
  const isCsv = resource.mime_type === 'text/csv';
  const isText = resource.mime_type?.startsWith('text/') && !isCsv;
  const isImage = resource.mime_type?.startsWith('image/');
  const isPdf = resource.mime_type === 'application/pdf';
  const previewUrl = getFullMediaUrl(resource.file_url || resource.download_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full relative min-h-[400px] max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl p-2 transition-all duration-200">
          <FaTimes className="text-xl" />
        </button>
        
        {/* Header moderno */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
            {isCsv ? <FaFileCsv className="text-xl" /> : isImage ? <FaFileImage className="text-xl" /> : isPdf ? <FaFilePdf className="text-xl" /> : <FaFileAlt className="text-xl" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Resource Preview</h2>
            <p className="text-gray-600 text-sm">{resource.name || resource.original_filename}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-40 text-gray-600">
            <Spinner />
            <span className="mt-3 font-medium">Loading preview...</span>
          </div>
        ) : error ? (
          <Alert message={error} />
        ) : (
          <>
            {isCsv && csvHeaders.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="overflow-x-auto max-h-96 border rounded-xl bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-purple-50 to-pink-50 sticky top-0 z-10">
                      <tr>
                        {csvHeaders.map(h => (
                          <th key={h} className="px-4 py-3 font-bold text-purple-700 border-b border-purple-200 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.map((row, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}>
                          {csvHeaders.map(h => (
                            <td key={h} className="px-4 py-2 border-b border-gray-200">
                              <input
                                type="text"
                                value={row[h] ?? ''}
                                onChange={e => handleCsvCellEdit(i, h, e.target.value)}
                                className="w-full px-3 py-2 border-0 rounded-lg bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500 mt-3 px-2 font-medium">
                  Showing first 50 rows. Edit and save to update.
                </div>
              </div>
            )}
            
            {isText && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <textarea
                  className="w-full border-0 rounded-xl p-4 text-sm font-mono bg-white shadow-sm min-h-[300px] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  value={textContent}
                  onChange={e => { setTextContent(e.target.value); setTextChanged(true); }}
                  placeholder="Text content will appear here..."
                />
              </div>
            )}
            
            {isImage && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 flex justify-center items-center">
                <img 
                  src={previewUrl} 
                  alt={resource.name} 
                  className="max-h-96 max-w-full rounded-xl shadow-lg" 
                />
              </div>
            )}
            
            {isPdf && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <iframe 
                  src={previewUrl} 
                  title="PDF Preview" 
                  className="w-full h-96 rounded-xl shadow-lg border-0" 
                />
              </div>
            )}
            
            {!isCsv && !isText && !isImage && !isPdf && (
              <div className="bg-gray-50 rounded-xl p-12 text-center text-gray-500 mb-6">
                <FaEye className="text-4xl mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Preview not available</p>
                <p className="text-sm">This file type cannot be previewed</p>
              </div>
            )}
          </>
        )}
        
        {/* Footer con bottoni moderni */}
        <div className="flex flex-wrap justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button 
            onClick={handleDownload} 
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <FaDownload />
            Download
          </button>
          
          {!onDownload && (
            <a
              href={previewUrl}
              download
              className="px-4 py-2 text-blue-600 hover:text-blue-800 underline text-sm font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Direct download
            </a>
          )}
          
          {(isCsv && csvChanged) && (
            <button 
              onClick={handleSaveCsv} 
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <FaSave />
              Save CSV
            </button>
          )}
          
          {(isText && textChanged) && (
            <button 
              onClick={handleSaveText} 
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <FaSave />
              Save Text
            </button>
          )}
          
          <button 
            onClick={onClose} 
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold shadow transition-all duration-200"
          >
            Close
          </button>
        </div>
        
        {downloadError && (
          <div className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-xl border border-red-200">
            {downloadError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourcePreviewModal; 