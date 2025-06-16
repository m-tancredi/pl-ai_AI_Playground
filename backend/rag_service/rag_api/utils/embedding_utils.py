"""
Utility per la gestione degli embeddings usando Sentence Transformers.
"""
import os
import logging
import pickle
import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path
from sentence_transformers import SentenceTransformer
from django.conf import settings
import faiss
from config.llm_clients import get_openai_client

logger = logging.getLogger(__name__)

class EmbeddingManager:
    """
    Gestisce la generazione e il recupero degli embedding.
    """
    def __init__(self):
        # Usa solo Sentence Transformers per ora (evita problemi con OpenAI client)
        self.client = None  # get_openai_client()
        self.model = getattr(settings, 'EMBEDDING_MODEL', 'text-embedding-ada-002')
        self.dimension = getattr(settings, 'EMBEDDING_DIMENSION', 384)
        self.model_name = getattr(settings, 'SENTENCE_TRANSFORMER_MODEL_NAME', 'all-MiniLM-L6-v2')
        self.model_instance = None
        self.embeddings_root = Path(settings.RAG_EMBEDDINGS_ROOT)
        self.embeddings_root.mkdir(exist_ok=True)
        
        # Cache per gli indici FAISS
        self._faiss_indices = {}
        self._chunk_mappings = {}
        
        logger.info(f"EmbeddingManager inizializzato con modello: {self.model_name}")
    
    def _load_model(self):
        """
        Carica il modello Sentence Transformers se non è già caricato.
        """
        if self.model_instance is None:
            try:
                logger.info(f"Caricamento modello Sentence Transformers: {self.model_name}")
                self.model_instance = SentenceTransformer(self.model_name)
                logger.info("Modello caricato con successo")
            except Exception as e:
                logger.error(f"Errore nel caricamento del modello: {str(e)}")
                raise Exception(f"Impossibile caricare il modello {self.model_name}: {str(e)}")
    
    def get_embedding(self, text: str) -> List[float]:
        """
        Genera l'embedding per un testo usando il modello configurato.
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Errore nella generazione dell'embedding: {str(e)}")
            raise

    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Genera gli embedding per una lista di testi.
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            logger.error(f"Errore nella generazione degli embedding in batch: {str(e)}")
            raise

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calcola la similarità del coseno tra due vettori.
        """
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

    def find_most_similar(self, query_embedding: List[float], 
                         embeddings: List[List[float]], 
                         top_k: int = 5) -> List[int]:
        """
        Trova gli indici dei k embedding più simili alla query.
        """
        similarities = [self.cosine_similarity(query_embedding, emb) for emb in embeddings]
        return np.argsort(similarities)[-top_k:][::-1]

    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Crea embeddings per una lista di testi.
        
        Args:
            texts (List[str]): Lista di testi
            
        Returns:
            np.ndarray: Array di embeddings
        """
        if not texts:
            return np.array([])
        
        self._load_model()
        
        try:
            logger.info(f"Creazione embeddings per {len(texts)} testi")
            embeddings = self.model_instance.encode(texts, show_progress_bar=True)
            logger.info(f"Embeddings creati: shape {embeddings.shape}")
            return embeddings
        except Exception as e:
            logger.error(f"Errore nella creazione degli embeddings: {str(e)}")
            raise Exception(f"Errore nella creazione degli embeddings: {str(e)}")
    
    def save_embeddings(self, document_id: int, embeddings: np.ndarray, 
                       chunks: List[str], metadata: Dict[str, Any] = None):
        """
        Salva gli embeddings su disco.
        
        Args:
            document_id (int): ID del documento
            embeddings (np.ndarray): Array di embeddings
            chunks (List[str]): Lista dei chunk di testo corrispondenti
            metadata (Dict): Metadati aggiuntivi
        """
        try:
            doc_dir = self.embeddings_root / str(document_id)
            doc_dir.mkdir(exist_ok=True)
            
            # Salva embeddings
            embeddings_path = doc_dir / "embeddings.npy"
            np.save(embeddings_path, embeddings)
            
            # Salva chunks
            chunks_path = doc_dir / "chunks.pkl"
            with open(chunks_path, 'wb') as f:
                pickle.dump(chunks, f)
            
            # Salva metadata
            if metadata:
                metadata_path = doc_dir / "metadata.pkl"
                with open(metadata_path, 'wb') as f:
                    pickle.dump(metadata, f)
            
            logger.info(f"Embeddings salvati per documento {document_id}")
            
        except Exception as e:
            logger.error(f"Errore nel salvataggio degli embeddings per documento {document_id}: {str(e)}")
            raise Exception(f"Errore nel salvataggio degli embeddings: {str(e)}")
    
    def load_embeddings(self, document_id: int) -> Tuple[np.ndarray, List[str], Dict[str, Any]]:
        """
        Carica gli embeddings dal disco.
        
        Args:
            document_id (int): ID del documento
            
        Returns:
            Tuple[np.ndarray, List[str], Dict]: Embeddings, chunks e metadata
        """
        try:
            doc_dir = self.embeddings_root / str(document_id)
            
            if not doc_dir.exists():
                raise FileNotFoundError(f"Embeddings non trovati per documento {document_id}")
            
            # Carica embeddings
            embeddings_path = doc_dir / "embeddings.npy"
            embeddings = np.load(embeddings_path)
            
            # Carica chunks
            chunks_path = doc_dir / "chunks.pkl"
            with open(chunks_path, 'rb') as f:
                chunks = pickle.load(f)
            
            # Carica metadata (opzionale)
            metadata_path = doc_dir / "metadata.pkl"
            metadata = {}
            if metadata_path.exists():
                with open(metadata_path, 'rb') as f:
                    metadata = pickle.load(f)
            
            logger.info(f"Embeddings caricati per documento {document_id}")
            return embeddings, chunks, metadata
            
        except Exception as e:
            logger.error(f"Errore nel caricamento degli embeddings per documento {document_id}: {str(e)}")
            raise Exception(f"Errore nel caricamento degli embeddings: {str(e)}")
    
    def delete_embeddings(self, document_id: int):
        """
        Elimina gli embeddings di un documento.
        
        Args:
            document_id (int): ID del documento
        """
        try:
            doc_dir = self.embeddings_root / str(document_id)
            
            if doc_dir.exists():
                import shutil
                shutil.rmtree(doc_dir)
                logger.info(f"Embeddings eliminati per documento {document_id}")
            
            # Rimuovi dalla cache
            if document_id in self._faiss_indices:
                del self._faiss_indices[document_id]
            if document_id in self._chunk_mappings:
                del self._chunk_mappings[document_id]
                
        except Exception as e:
            logger.error(f"Errore nell'eliminazione degli embeddings per documento {document_id}: {str(e)}")
            raise Exception(f"Errore nell'eliminazione degli embeddings: {str(e)}")
    
    def create_faiss_index(self, document_ids: List[int]) -> Tuple[faiss.IndexFlatIP, List[Tuple[int, int]]]:
        """
        Crea un indice FAISS per la ricerca di similarità.
        
        Args:
            document_ids (List[int]): Lista degli ID dei documenti
            
        Returns:
            Tuple[faiss.Index, List[Tuple[int, int]]]: Indice FAISS e mapping chunk->documento
        """
        try:
            all_embeddings = []
            chunk_to_doc_mapping = []  # (doc_id, chunk_index)
            
            for doc_id in document_ids:
                try:
                    embeddings, chunks, _ = self.load_embeddings(doc_id)
                    
                    if embeddings.size > 0:
                        all_embeddings.append(embeddings)
                        for i in range(len(chunks)):
                            chunk_to_doc_mapping.append((doc_id, i))
                            
                except Exception as e:
                    logger.warning(f"Impossibile caricare embeddings per documento {doc_id}: {str(e)}")
                    continue
            
            if not all_embeddings:
                raise Exception("Nessun embedding trovato per i documenti specificati")
            
            # Concatena tutti gli embeddings
            combined_embeddings = np.vstack(all_embeddings)
            
            # Normalizza gli embeddings per la ricerca coseno
            faiss.normalize_L2(combined_embeddings)
            
            # Crea indice FAISS (Inner Product per coseno con embeddings normalizzati)
            dimension = combined_embeddings.shape[1]
            index = faiss.IndexFlatIP(dimension)
            
            # Aggiungi embeddings all'indice
            index.add(combined_embeddings.astype(np.float32))
            
            logger.info(f"Indice FAISS creato con {index.ntotal} embeddings da {len(document_ids)} documenti")
            
            return index, chunk_to_doc_mapping
            
        except Exception as e:
            logger.error(f"Errore nella creazione dell'indice FAISS: {str(e)}")
            raise Exception(f"Errore nella creazione dell'indice FAISS: {str(e)}")
    
    def search_similar_chunks(self, query: str, document_ids: List[int], 
                            top_k: int = 5) -> List[Tuple[str, float, int]]:
        """
        Cerca i chunk più simili alla query.
        
        Args:
            query (str): Query di ricerca
            document_ids (List[int]): Lista degli ID dei documenti da cercare
            top_k (int): Numero di risultati da restituire
            
        Returns:
            List[Tuple[str, float, int]]: Lista di (chunk_text, score, document_id)
        """
        try:
            if not document_ids:
                return []
            
            # Crea embedding per la query
            self._load_model()
            query_embedding = self.model_instance.encode([query])
            faiss.normalize_L2(query_embedding)
            
            # Crea o recupera l'indice FAISS
            index_key = tuple(sorted(document_ids))
            if index_key not in self._faiss_indices:
                index, chunk_mapping = self.create_faiss_index(document_ids)
                self._faiss_indices[index_key] = index
                self._chunk_mappings[index_key] = chunk_mapping
            else:
                index = self._faiss_indices[index_key]
                chunk_mapping = self._chunk_mappings[index_key]
            
            # Ricerca
            scores, indices = index.search(query_embedding.astype(np.float32), top_k)
            
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx >= 0 and idx < len(chunk_mapping):
                    doc_id, chunk_idx = chunk_mapping[idx]
                    
                    # Carica il chunk specifico
                    try:
                        _, chunks, _ = self.load_embeddings(doc_id)
                        if chunk_idx < len(chunks):
                            chunk_text = chunks[chunk_idx]
                            results.append((chunk_text, float(score), doc_id))
                    except Exception as e:
                        logger.warning(f"Errore nel caricamento del chunk {chunk_idx} del documento {doc_id}: {str(e)}")
                        continue
            
            logger.info(f"Trovati {len(results)} chunk simili per la query")
            return results
            
        except Exception as e:
            logger.error(f"Errore nella ricerca di chunk simili: {str(e)}")
            raise Exception(f"Errore nella ricerca di chunk simili: {str(e)}")
    
    def get_document_embeddings_info(self, document_id: int) -> Dict[str, Any]:
        """
        Ottieni informazioni sugli embeddings di un documento.
        
        Args:
            document_id (int): ID del documento
            
        Returns:
            Dict[str, Any]: Informazioni sugli embeddings
        """
        try:
            doc_dir = self.embeddings_root / str(document_id)
            
            if not doc_dir.exists():
                return {"exists": False}
            
            embeddings, chunks, metadata = self.load_embeddings(document_id)
            
            return {
                "exists": True,
                "num_chunks": len(chunks),
                "embedding_dimension": embeddings.shape[1] if embeddings.size > 0 else 0,
                "total_embeddings": embeddings.shape[0] if embeddings.size > 0 else 0,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Errore nel recupero delle informazioni degli embeddings per documento {document_id}: {str(e)}")
            return {"exists": False, "error": str(e)}
    
    def clear_cache(self):
        """
        Pulisce la cache degli indici FAISS.
        """
        self._faiss_indices.clear()
        self._chunk_mappings.clear()
        logger.info("Cache degli indici FAISS pulita")

# Istanza globale del manager degli embeddings
_embedding_manager = None

def get_embedding_manager() -> EmbeddingManager:
    """
    Factory function per ottenere un'istanza di EmbeddingManager.
    """
    global _embedding_manager
    if _embedding_manager is None:
        _embedding_manager = EmbeddingManager()
    return _embedding_manager 