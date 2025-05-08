// src/components/AlertModal.jsx (Esempio Base)
// import React from 'react'; (Se in file separato)
// const ModalShell = ... (Potresti importarlo o ridefinirlo)

const AlertModal = ({ isOpen, onClose, title = "Alert", children }) => {
    return (
     <ModalShell isOpen={isOpen} onClose={onClose} title={title}>
         <div className="text-sm text-gray-700">
             {children}
         </div>
     </ModalShell>
   );
 };
 
 export { AlertModal };