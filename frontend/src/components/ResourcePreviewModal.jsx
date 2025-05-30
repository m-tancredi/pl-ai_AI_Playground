import React, { useState, useEffect } from 'react';
import { FaTimes, FaDownload, FaSave, FaSpinner, FaFileImage, FaFilePdf, FaFileAlt, FaFileCsv } from 'react-icons/fa';
import Papa from 'papaparse';
import { getFullMediaUrl } from '../utils/getFullMediaUrl';

const Spinner = () => <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>;
const Alert = ({ message }) => message ? <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-3 text-sm">{message}</div> : null;

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
        // Fallback: download diretto
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-3xl w-full relative animate-fadeInUp min-h-[300px]">
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-3xl"><FaTimes /></button>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
          {isCsv ? <FaFileCsv className="text-green-500" /> : isImage ? <FaFileImage className="text-blue-500" /> : isPdf ? <FaFilePdf className="text-red-500" /> : <FaFileAlt className="text-gray-400" />}
          Anteprima: {resource.name || resource.original_filename}
        </h2>
        {loading ? <div className="flex justify-center items-center h-40"><Spinner /></div> : error ? <Alert message={error} /> : (
          <>
            {isCsv && csvHeaders.length > 0 && (
              <div className="overflow-x-auto max-h-96 border rounded-xl mb-4">
                <table className="min-w-full text-xs">
                  <thead className="bg-indigo-50 sticky top-0 z-10">
                    <tr>
                      {csvHeaders.map(h => <th key={h} className="px-3 py-2 font-bold text-indigo-700 border-b">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.map((row, i) => (
                      <tr key={i} className="even:bg-gray-50">
                        {csvHeaders.map(h => (
                          <td key={h} className="px-2 py-1 border-b">
                            <input
                              type="text"
                              value={row[h] ?? ''}
                              onChange={e => handleCsvCellEdit(i, h, e.target.value)}
                              className="w-24 px-1 py-0.5 border rounded text-xs bg-white"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-gray-400 mt-1 px-2">Mostrando le prime 50 righe. Modifica e salva per aggiornare.</div>
              </div>
            )}
            {isText && (
              <textarea
                className="w-full border rounded p-2 text-sm font-mono mb-4 min-h-[200px]"
                value={textContent}
                onChange={e => { setTextContent(e.target.value); setTextChanged(true); }}
              />
            )}
            {isImage && (
              <div className="flex justify-center items-center mb-4">
                <img src={previewUrl} alt={resource.name} className="max-h-96 rounded shadow" />
              </div>
            )}
            {isPdf && (
              <div className="flex justify-center items-center mb-4">
                <iframe src={previewUrl} title="PDF Preview" className="w-full h-96 rounded shadow" />
              </div>
            )}
            {!isCsv && !isText && !isImage && !isPdf && (
              <div className="text-gray-500 text-center py-10">Anteprima non disponibile per questo tipo di file.</div>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={handleDownload} className="px-5 py-2 bg-blue-100 text-blue-700 rounded-full font-semibold hover:bg-blue-200 flex items-center gap-2"><FaDownload /> Scarica</button>
          {/* Fallback link diretto se onDownload non è fornito */}
          {!onDownload && (
            <a
              href={previewUrl}
              download
              className="ml-2 text-xs text-blue-500 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download diretto
            </a>
          )}
          {(isCsv && csvChanged) && <button onClick={handleSaveCsv} className="px-5 py-2 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 flex items-center gap-2"><FaSave /> Salva</button>}
          {(isText && textChanged) && <button onClick={handleSaveText} className="px-5 py-2 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 flex items-center gap-2"><FaSave /> Salva</button>}
          <button onClick={onClose} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 ml-2">Chiudi</button>
        </div>
        {downloadError && <div className="text-red-600 text-xs mt-2">{downloadError}</div>}
      </div>
    </div>
  );
};

export default ResourcePreviewModal; 