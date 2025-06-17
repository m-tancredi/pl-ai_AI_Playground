import React, { useState, useEffect } from 'react';
import { 
    PlusIcon, 
    MagnifyingGlassIcon,
    FunnelIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { ragService } from '../services/ragService';
import KnowledgeBaseCard from '../components/KnowledgeBaseCard';
import KnowledgeBaseModal from '../components/KnowledgeBaseModal';
import KnowledgeBaseChatModal from '../components/KnowledgeBaseChatModal';
import KnowledgeBaseStatsModal from '../components/KnowledgeBaseStatsModal';

const KnowledgeBasePage = () => {
    // Stati principali
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Stati per i modali
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [selectedKB, setSelectedKB] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);

    // Stati per filtri e ricerca
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('updated_at');

    // Carica dati iniziali
    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [kbResponse, docsResponse] = await Promise.all([
                ragService.listKnowledgeBases(),
                ragService.listUserDocuments()
            ]);

            setKnowledgeBases(kbResponse.results || kbResponse);
            setDocuments(docsResponse.results || docsResponse);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Gestione Knowledge Base
    const handleCreateKB = async (kbData) => {
        try {
            setModalLoading(true);
            
            // Crea la KB
            const newKB = await ragService.createKnowledgeBase({
                name: kbData.name,
                description: kbData.description,
                chunk_size: kbData.chunk_size,
                chunk_overlap: kbData.chunk_overlap,
                embedding_model: kbData.embedding_model
            });

            // Aggiungi documenti se selezionati
            if (kbData.selectedDocuments && kbData.selectedDocuments.length > 0) {
                await ragService.addDocumentsToKnowledgeBase(newKB.id, kbData.selectedDocuments);
            }

            // Ricarica la lista
            await loadInitialData();
            setShowCreateModal(false);
            
            // Mostra notifica di successo (implementare toast)
            console.log('Knowledge Base creata con successo!');
        } catch (err) {
            setError(err.message);
        } finally {
            setModalLoading(false);
        }
    };

    const handleEditKB = async (kbData) => {
        try {
            setModalLoading(true);
            
            // Aggiorna la KB
            await ragService.updateKnowledgeBase(selectedKB.id, {
                name: kbData.name,
                description: kbData.description,
                chunk_size: kbData.chunk_size,
                chunk_overlap: kbData.chunk_overlap,
                embedding_model: kbData.embedding_model
            });

            // Gestisci documenti
            const currentDocIds = selectedKB.documents?.map(doc => doc.id) || [];
            const newDocIds = kbData.selectedDocuments || [];
            
            const toAdd = newDocIds.filter(id => !currentDocIds.includes(id));
            const toRemove = currentDocIds.filter(id => !newDocIds.includes(id));

            if (toAdd.length > 0) {
                await ragService.addDocumentsToKnowledgeBase(selectedKB.id, toAdd);
            }
            if (toRemove.length > 0) {
                await ragService.removeDocumentsFromKnowledgeBase(selectedKB.id, toRemove);
            }

            // Ricarica la lista
            await loadInitialData();
            setShowEditModal(false);
            setSelectedKB(null);
            
            console.log('Knowledge Base aggiornata con successo!');
        } catch (err) {
            setError(err.message);
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeleteKB = async (kbId) => {
        if (!window.confirm('Sei sicuro di voler eliminare questa Knowledge Base? Questa azione non può essere annullata.')) {
            return;
        }

        try {
            await ragService.deleteKnowledgeBase(kbId);
            await loadInitialData();
            console.log('Knowledge Base eliminata con successo!');
        } catch (err) {
            setError(err.message);
        }
    };

    // Gestione azioni
    const handleViewKB = async (kbId) => {
        try {
            const kb = await ragService.getKnowledgeBase(kbId);
            setSelectedKB(kb);
            // Implementare modal di visualizzazione dettagli
            console.log('Visualizza KB:', kb);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEditKBModal = async (kbId) => {
        try {
            const kb = await ragService.getKnowledgeBase(kbId);
            setSelectedKB(kb);
            setShowEditModal(true);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleChatKB = async (kbId) => {
        try {
            const kb = await ragService.getKnowledgeBase(kbId);
            setSelectedKB(kb);
            setShowChatModal(true);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleStatsKB = async (kbId) => {
        try {
            const kb = await ragService.getKnowledgeBase(kbId);
            setSelectedKB(kb);
            setShowStatsModal(true);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSendChatMessage = async (kbId, message, options) => {
        return await ragService.sendKnowledgeBaseChatMessage(kbId, message, options);
    };

    const handleLoadStatistics = async (kbId) => {
        return await ragService.getKnowledgeBaseStatistics(kbId);
    };

    // Filtri e ricerca
    const filteredKBs = knowledgeBases.filter(kb => {
        const matchesSearch = kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            kb.description?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'ready' && kb.processed_documents_count > 0) ||
                            (statusFilter === 'empty' && kb.total_documents === 0) ||
                            (statusFilter === 'processing' && kb.processing_documents_count > 0);
        
        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'created_at':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'updated_at':
                return new Date(b.updated_at) - new Date(a.updated_at);
            case 'documents':
                return b.total_documents - a.total_documents;
            default:
                return 0;
        }
    });

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Caricamento Knowledge Base...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
                        <p className="text-gray-600 mt-1">
                            Gestisci le tue collezioni di documenti e avvia chat dedicate
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Crea Knowledge Base
                    </button>
                </div>

                {/* Statistiche rapide */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-900">{knowledgeBases.length}</div>
                        <div className="text-sm text-blue-700">Knowledge Base Totali</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-900">
                            {knowledgeBases.reduce((sum, kb) => sum + kb.total_documents, 0)}
                        </div>
                        <div className="text-sm text-green-700">Documenti Totali</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-900">
                            {knowledgeBases.reduce((sum, kb) => sum + kb.total_chunks, 0)}
                        </div>
                        <div className="text-sm text-purple-700">Chunk Totali</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-900">
                            {knowledgeBases.filter(kb => kb.processed_documents_count > 0).length}
                        </div>
                        <div className="text-sm text-yellow-700">KB Pronte</div>
                    </div>
                </div>

                {/* Filtri e ricerca */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cerca knowledge base..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Tutti gli stati</option>
                            <option value="ready">Pronte</option>
                            <option value="processing">In elaborazione</option>
                            <option value="empty">Vuote</option>
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="updated_at">Ultimo aggiornamento</option>
                            <option value="created_at">Data creazione</option>
                            <option value="name">Nome</option>
                            <option value="documents">Numero documenti</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Messaggio di errore */}
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                        <span className="text-red-800">{error}</span>
                    </div>
                </div>
            )}

            {/* Lista Knowledge Base */}
            {filteredKBs.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                        <FunnelIcon className="w-16 h-16 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {knowledgeBases.length === 0 ? 'Nessuna Knowledge Base' : 'Nessun risultato'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                        {knowledgeBases.length === 0 
                            ? 'Crea la tua prima knowledge base per organizzare i documenti'
                            : 'Prova a modificare i filtri di ricerca'
                        }
                    </p>
                    {knowledgeBases.length === 0 && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Crea la prima Knowledge Base
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredKBs.map(kb => (
                        <KnowledgeBaseCard
                            key={kb.id}
                            knowledgeBase={kb}
                            onView={handleViewKB}
                            onEdit={handleEditKBModal}
                            onDelete={handleDeleteKB}
                            onChat={handleChatKB}
                            onStatistics={handleStatsKB}
                        />
                    ))}
                </div>
            )}

            {/* Modali */}
            <KnowledgeBaseModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSave={handleCreateKB}
                documents={documents}
                isLoading={modalLoading}
            />

            <KnowledgeBaseModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedKB(null);
                }}
                onSave={handleEditKB}
                knowledgeBase={selectedKB}
                documents={documents}
                isLoading={modalLoading}
            />

            <KnowledgeBaseChatModal
                isOpen={showChatModal}
                onClose={() => {
                    setShowChatModal(false);
                    setSelectedKB(null);
                }}
                knowledgeBase={selectedKB}
                onSendMessage={handleSendChatMessage}
            />

            <KnowledgeBaseStatsModal
                isOpen={showStatsModal}
                onClose={() => {
                    setShowStatsModal(false);
                    setSelectedKB(null);
                }}
                knowledgeBase={selectedKB}
                onLoadStatistics={handleLoadStatistics}
            />
        </div>
    );
};

export default KnowledgeBasePage; 