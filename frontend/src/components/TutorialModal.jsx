// src/components/TutorialModal.jsx (Esempio Base)
import React from 'react';

const ModalShell = ({ isOpen, onClose, title, children }) => { // Componente base riutilizzabile
     if (!isOpen) return null;
     return (
         <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-6 border-0 w-full max-w-2xl shadow-xl rounded-lg bg-white">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                    <h3 className="text-xl font-medium text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" aria-label="Close modal">
                        {/* SVG Close Icon */}
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>
                <div className="mt-4 text-sm text-gray-600 max-h-[60vh] overflow-y-auto pr-2">
                    {children}
                </div>
                 <div className="mt-5 pt-4 border-t border-gray-200 text-right">
                     <button onClick={onClose} type="button" className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> Got it! </button>
                 </div>
            </div>
        </div>
     );
};

const TutorialModal = ({ isOpen, onClose }) => {
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Image Classifier Tutorial">
      <p className="mb-3">Train your own image classifier!</p>
      <ol className="list-decimal list-inside space-y-2 mb-4">
        <li><strong>Add Classes:</strong> Click "Add Class" (up to 5). Name each class clearly (e.g., "Cat", "Dog", "My Face").</li>
        <li><strong>Capture Images:</strong> Click "Start Capture" for a class. Hold objects/pose in front of the webcam. Capture at least 10-20 images per class from different angles/lighting. Click "Stop Capture" when done.</li>
        <li><strong>Train Model:</strong> Once you have enough images for at least two classes, click the main "TRAIN MODEL" button. Training happens in the background.</li>
        <li><strong>Monitor:</strong> Check the status message and console logs. Training can take some time.</li>
        <li><strong>Classify:</strong> After training completes, point your webcam at objects. The right panel will show real-time predictions!</li>
      </ol>
      <p className="text-xs italic text-gray-500">Tips: More images per class and varied examples generally lead to better accuracy. Ensure good lighting.</p>
    </ModalShell>
  );
};

export default TutorialModal;