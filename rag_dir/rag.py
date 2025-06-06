@app.route('/rag')
@login_required
def rag():
    """Renderizza la pagina RAG"""
    # Inizializza il database se necessario
    db_path = get_user_db_path(session.get('username'))
    init_rag_database(db_path)
    return render_template('rag.html')

@app.route('/upload_rag_document', methods=['POST'])
@login_required
def upload_rag_document():
    """Endpoint per caricare documenti per RAG"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Nessun file inviato'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Nessun file selezionato'}), 400
    
    # Crea directory per documenti RAG dell'utente se non esiste
    user_id = session.get('user_id')
    user_rag_dir = os.path.join('user_data', str(user_id), 'rag_documents')
    os.makedirs(user_rag_dir, exist_ok=True)
    
    # Salva il file con nome sicuro
    filename = secure_filename(file.filename)
    file_path = os.path.join(user_rag_dir, filename)
    
    # Controlla se il file esiste già e aggiungi un suffisso numerico se necessario
    base_name, extension = os.path.splitext(filename)
    counter = 1
    while os.path.exists(file_path):
        filename = f"{base_name}_{counter}{extension}"
        file_path = os.path.join(user_rag_dir, filename)
        counter += 1
    
    try:
        file.save(file_path)
        
        # Salva informazioni sul file nel database dell'utente
        db_path = get_user_db_path(session.get('username'))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Crea tabella se non esiste
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS rag_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed BOOLEAN DEFAULT 0,
            text_content TEXT,
            embedding_path TEXT
        )
        ''')
        
        # Determina il tipo di file
        file_type = extension.lower().replace('.', '')
        file_size = os.path.getsize(file_path)
        
        # Inserisci record nel database
        cursor.execute('''
        INSERT INTO rag_documents (filename, file_path, file_type, size)
        VALUES (?, ?, ?, ?)
        ''', (filename, file_path, file_type, file_size))
        
        file_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True, 
            'filename': filename,
            'file_id': file_id
        }), 200
        
    except Exception as e:
        print(f"Errore durante il caricamento del file: {str(e)}")
        # Se c'è un errore, elimina il file se è stato creato
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        return jsonify({
            'success': False, 
            'error': f'Errore durante il caricamento del file: {str(e)}'
        }), 500

@app.route('/process_rag_documents', methods=['POST'])
@login_required
def process_rag_documents():
    """Avvia il processo di elaborazione dei documenti caricati"""
    try:
        user_id = session.get('user_id')
        print(f"[DEBUG] Starting document processing for user {user_id}")
        
        # Crea directory per i file elaborati se non esiste
        user_rag_processed_dir = os.path.join('user_data', str(user_id), 'rag_processed')
        os.makedirs(user_rag_processed_dir, exist_ok=True)
        
        # Inizializza lo stato di elaborazione nella sessione
        session['rag_processing'] = {
            'status': 'starting',
            'progress': 0,
            'total_documents': 0,
            'processed_documents': 0,
            'failed_documents': 0,
            'current_document': '',
            'errors': []
        }
        
        # Ottieni i documenti non elaborati dal database
        db_path = get_user_db_path(session.get('username'))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT id, filename, file_path, file_type FROM rag_documents 
        WHERE processed = 0
        ''')
        
        documents = cursor.fetchall()
        conn.close()
        
        print(f"[DEBUG] Found {len(documents)} documents to process")
        
        # Aggiorna lo stato di elaborazione
        session['rag_processing']['total_documents'] = len(documents)
        session.modified = True
        
        if len(documents) == 0:
            print("[DEBUG] No documents to process")
            return jsonify({'success': False, 'error': 'Nessun documento da elaborare'}), 400
        
        # Avvia l'estrazione del testo
        print("[DEBUG] Starting text extraction")
        extract_text_from_documents()
        
        return jsonify({
            'success': True, 
            'message': 'Elaborazione documenti avviata', 
            'document_count': len(documents)
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Error in process_rag_documents: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Errore durante l\'elaborazione dei documenti: {str(e)}'
        }), 500

@app.route('/check_text_extraction_status')
@login_required
def check_text_extraction_status():
    """Controlla lo stato dell'estrazione del testo dai documenti"""
    # In un'implementazione reale, questo dovrebbe controllare lo stato di un task asincrono
    # Per questa demo, simuliamo l'avanzamento dell'estrazione del testo
    
    processing_state = session.get('rag_processing', {
        'status': 'not_started',
        'progress': 0,
        'total_documents': 0,
        'processed_documents': 0,
        'failed_documents': 0,
        'current_document': '',
        'errors': []
    })
    
    print(f"[DEBUG] Current processing state: {processing_state}")
    
    # Se non è stato avviato, avvia l'estrazione del testo
    if processing_state['status'] == 'starting':
        print("[DEBUG] Starting text extraction process")
        # Simuliamo l'avvio dell'estrazione del testo
        processing_state['status'] = 'extracting_text'
        processing_state['progress'] = 10
        session['rag_processing'] = processing_state
        session.modified = True
        
        # Avvia l'estrazione del testo (simulata)
        extract_text_from_documents()
        
        return jsonify({
            'status_message': 'Avvio estrazione testo...',
            'progress': 10,
            'completed': False,
            'success': True
        })
    
    # Se l'estrazione è in corso, restituisci lo stato corrente
    elif processing_state['status'] == 'extracting_text':
        total = processing_state['total_documents']
        processed = processing_state['processed_documents']
        failed = processing_state['failed_documents']
        current = processing_state['current_document']
        
        print(f"[DEBUG] Extraction in progress - Total: {total}, Processed: {processed}, Failed: {failed}, Current: {current}")
        
        # Calcola la percentuale di avanzamento (dal 10% al 50%)
        if total > 0:
            base_progress = 10
            extraction_progress = int(40 * (processed + failed) / total)
            progress = min(base_progress + extraction_progress, 50)
        else:
            progress = 10
        
        print(f"[DEBUG] Calculated progress: {progress}%")
        
        processing_state['progress'] = progress
        session['rag_processing'] = processing_state
        session.modified = True
        
        # Controlla se l'estrazione è completata
        completed = (processed + failed) >= total
        success = failed < total  # Consideriamo il processo riuscito se almeno un documento è stato elaborato con successo
        
        if completed:
            print("[DEBUG] Text extraction completed")
            processing_state['status'] = 'text_extraction_completed'
            session['rag_processing'] = processing_state
            session.modified = True
        
        return jsonify({
            'status_message': f"Estrazione testo: {processed}/{total} documenti" + (f" (Elaborazione: {current})" if current else ""),
            'progress': progress,
            'completed': completed,
            'success': success,
            'errors': processing_state['errors'] if failed > 0 else []
        })
    
    # Se l'estrazione è completata
    elif processing_state['status'] == 'text_extraction_completed':
        print("[DEBUG] Text extraction already completed")
        return jsonify({
            'status_message': 'Estrazione testo completata',
            'progress': 50,
            'completed': True,
            'success': processing_state['failed_documents'] < processing_state['total_documents']
        })
    
    # Se non è stato avviato
    else:
        print("[DEBUG] Text extraction not started")
        return jsonify({
            'status_message': 'Estrazione testo non avviata',
            'progress': 0,
            'completed': False,
            'success': False
        })

def extract_text_from_documents():
    """Estrae il testo dai documenti caricati"""
    user_id = session.get('user_id')
    db_path = get_user_db_path(session.get('username'))
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"[DEBUG] Starting text extraction for user {user_id}")
    
    # Ottieni i documenti non elaborati
    cursor.execute('''
    SELECT id, filename, file_path, file_type FROM rag_documents 
    WHERE processed = 0
    ''')
    
    documents = cursor.fetchall()
    print(f"[DEBUG] Found {len(documents)} documents to process")
    
    for doc_id, filename, file_path, file_type in documents:
        try:
            print(f"[DEBUG] Processing document: {filename} (ID: {doc_id}, Type: {file_type})")
            
            # Aggiorna lo stato di elaborazione
            processing_state = session.get('rag_processing', {})
            processing_state['current_document'] = filename
            session['rag_processing'] = processing_state
            session.modified = True
            
            text_content = ""
            
            # Estrai il testo in base al tipo di file
            if file_type in ['txt']:
                print(f"[DEBUG] Extracting text from TXT file")
                with open(file_path, 'r', encoding='utf-8') as f:
                    text_content = f.read()
                print(f"[DEBUG] Extracted {len(text_content)} characters from TXT")
            
            elif file_type in ['pdf']:
                print(f"[DEBUG] Extracting text from PDF file")
                import PyPDF2
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    num_pages = len(pdf_reader.pages)
                    print(f"[DEBUG] PDF has {num_pages} pages")
                    text_content = ""
                    for i, page in enumerate(pdf_reader.pages):
                        print(f"[DEBUG] Processing page {i+1}/{num_pages}")
                        page_text = page.extract_text() or ""
                        text_content += page_text + "\n"
                        print(f"[DEBUG] Extracted {len(page_text)} characters from page {i+1}")
                print(f"[DEBUG] Total extracted text length: {len(text_content)} characters")
            
            elif file_type in ['doc', 'docx']:
                print(f"[DEBUG] Extracting text from DOC/DOCX file")
                import docx
                doc = docx.Document(file_path)
                text_content = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                print(f"[DEBUG] Extracted {len(text_content)} characters from DOC/DOCX")
            
            elif file_type in ['jpg', 'jpeg', 'png']:
                print(f"[DEBUG] Extracting text from image file")
                import pytesseract
                from PIL import Image
                image = Image.open(file_path)
                print(f"[DEBUG] Image size: {image.size}, format: {image.format}")
                text_content = pytesseract.image_to_string(image, lang='ita+eng')
                print(f"[DEBUG] Extracted {len(text_content)} characters from image")
            
            print(f"[DEBUG] Saving extracted text to database for document {doc_id}")
            # Salva il testo estratto nel database
            cursor.execute('''
            UPDATE rag_documents 
            SET text_content = ?, processed = 1
            WHERE id = ?
            ''', (text_content, doc_id))
            
            conn.commit()
            print(f"[DEBUG] Successfully saved text to database for document {doc_id}")
            
            # Aggiorna il contatore dei documenti elaborati
            processing_state = session.get('rag_processing', {})
            processing_state['processed_documents'] += 1
            session['rag_processing'] = processing_state
            session.modified = True
            print(f"[DEBUG] Updated processing state: {processing_state['processed_documents']} documents processed")
            
        except Exception as e:
            print(f"[ERROR] Error processing document {filename}: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Aggiorna il contatore dei documenti falliti
            processing_state = session.get('rag_processing', {})
            processing_state['failed_documents'] += 1
            processing_state['errors'].append(f"Errore nel documento {filename}: {str(e)}")
            session['rag_processing'] = processing_state
            session.modified = True
            print(f"[DEBUG] Updated processing state: {processing_state['failed_documents']} documents failed")
    
    print("[DEBUG] Text extraction process completed")
    conn.close()

@app.route('/create_rag_embeddings', methods=['POST'])
@login_required
def create_rag_embeddings():
    """Avvia il processo di creazione degli embedding"""
    try:
        print("[DEBUG] Starting embedding creation process")
        # Inizializza lo stato di elaborazione nella sessione
        session['rag_embedding'] = {
            'status': 'starting',
            'progress': 0,
            'total_documents': 0,
            'processed_documents': 0,
            'failed_documents': 0,
            'errors': []
        }
        
        # Ottieni i documenti da processare
        db_path = get_user_db_path(session.get('username'))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT id, text_content FROM rag_documents 
        WHERE processed = 1 AND embedding_path IS NULL
        ''')
        
        documents = cursor.fetchall()
        conn.close()
        
        print(f"[DEBUG] Found {len(documents)} documents for embedding creation")
        
        # Aggiorna lo stato
        session['rag_embedding']['total_documents'] = len(documents)
        session['rag_embedding']['status'] = 'creating_embeddings'
        session.modified = True
        
        if len(documents) == 0:
            print("[DEBUG] No documents to create embeddings for")
            return jsonify({'success': False, 'error': 'Nessun documento da elaborare'}), 400
        
        # Avvia il processo di creazione degli embedding
        create_embeddings_for_documents()
        
        return jsonify({'success': True, 'message': 'Creazione embedding avviata'}), 200
        
    except Exception as e:
        print(f"[ERROR] Error in create_rag_embeddings: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Errore durante la creazione degli embedding: {str(e)}'
        }), 500

@app.route('/check_embedding_status')
@login_required
def check_embedding_status():
    """Controlla lo stato della creazione degli embedding"""
    try:
        embedding_state = session.get('rag_embedding', {
            'status': 'not_started',
            'progress': 0,
            'total_documents': 0,
            'processed_documents': 0,
            'failed_documents': 0,
            'errors': []
        })
        
        print(f"[DEBUG] Current embedding state: {embedding_state}")
        
        # Se non è stato avviato
        if embedding_state['status'] == 'not_started':
            print("[DEBUG] Embedding process not started")
            return jsonify({
                'status_message': 'Creazione embedding non avviata',
                'progress': 0,
                'completed': False,
                'success': False
            })
        
        # Se è in corso
        elif embedding_state['status'] == 'creating_embeddings':
            total = embedding_state['total_documents']
            processed = embedding_state['processed_documents']
            failed = embedding_state['failed_documents']
            
            print(f"[DEBUG] Embedding in progress - Total: {total}, Processed: {processed}, Failed: {failed}")
            
            # Calcola la percentuale di avanzamento (dal 60% al 100%)
            if total > 0:
                base_progress = 60
                embedding_progress = int(40 * (processed + failed) / total)
                progress = min(base_progress + embedding_progress, 100)
            else:
                progress = 60
            
            print(f"[DEBUG] Calculated progress: {progress}%")
            
            # Controlla se la creazione è completata
            completed = (processed + failed) >= total
            success = failed < total
            
            if completed:
                print("[DEBUG] Embedding creation completed")
                embedding_state['status'] = 'completed'
                session['rag_embedding'] = embedding_state
                session.modified = True
            
            return jsonify({
                'status_message': f"Creazione embedding: {processed}/{total} documenti",
                'progress': progress,
                'completed': completed,
                'success': success,
                'errors': embedding_state['errors'] if failed > 0 else []
            })
        
        # Se è completata
        elif embedding_state['status'] == 'completed':
            print("[DEBUG] Embedding creation already completed")
            return jsonify({
                'status_message': 'Creazione embedding completata',
                'progress': 100,
                'completed': True,
                'success': True
            })
        
        # Stato non riconosciuto
        else:
            print(f"[DEBUG] Unknown embedding state: {embedding_state['status']}")
            return jsonify({
                'status_message': 'Stato non riconosciuto',
                'progress': 0,
                'completed': False,
                'success': False
            })
            
    except Exception as e:
        print(f"[ERROR] Error in check_embedding_status: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status_message': f'Errore durante il controllo dello stato: {str(e)}',
            'progress': 0,
            'completed': False,
            'success': False
        }), 500

def create_embeddings_for_documents():
    """Crea gli embedding per i documenti processati"""
    try:
        print("[DEBUG] Starting embedding creation process")
        # Ottieni i documenti da processare
        db_path = get_user_db_path(session.get('username'))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT id, text_content FROM rag_documents 
        WHERE processed = 1 AND embedding_path IS NULL
        ''')
        
        documents = cursor.fetchall()
        print(f"[DEBUG] Found {len(documents)} documents for embedding creation")
        
        if not documents:
            print("[DEBUG] No documents to create embeddings for")
            return
        
        # Aggiorna lo stato iniziale
        session['rag_embedding'] = {
            'status': 'creating_embeddings',
            'progress': 0,
            'total_documents': len(documents),
            'processed_documents': 0,
            'failed_documents': 0,
            'errors': []
        }
        session.modified = True
        
        # Crea la directory per gli embedding se non esiste
        embeddings_dir = os.path.join(os.path.dirname(db_path), 'embeddings')
        os.makedirs(embeddings_dir, exist_ok=True)
        
        # Processa ogni documento
        for doc_id, text_content in documents:
            try:
                print(f"[DEBUG] Creating embedding for document {doc_id}")
                # Crea l'embedding
                embedding = create_embedding(text_content)
                
                # Salva l'embedding
                embedding_path = os.path.join(embeddings_dir, f'doc_{doc_id}.npy')
                np.save(embedding_path, embedding)
                
                # Aggiorna il database
                cursor.execute('''
                UPDATE rag_documents 
                SET embedding_path = ? 
                WHERE id = ?
                ''', (embedding_path, doc_id))
                conn.commit()
                
                # Aggiorna lo stato
                session['rag_embedding']['processed_documents'] += 1
                session.modified = True
                print(f"[DEBUG] Successfully created embedding for document {doc_id}")
                
            except Exception as e:
                print(f"[ERROR] Error creating embedding for document {doc_id}: {str(e)}")
                session['rag_embedding']['failed_documents'] += 1
                session['rag_embedding']['errors'].append(f"Errore documento {doc_id}: {str(e)}")
                session.modified = True
        
        # Aggiorna lo stato finale
        session['rag_embedding']['status'] = 'completed'
        session.modified = True
        print("[DEBUG] Embedding creation process completed")
        
    except Exception as e:
        print(f"[ERROR] Error in create_embeddings_for_documents: {str(e)}")
        import traceback
        traceback.print_exc()
        if 'rag_embedding' in session:
            session['rag_embedding']['status'] = 'error'
            session['rag_embedding']['errors'].append(str(e))
            session.modified = True
    finally:
        if 'conn' in locals():
            conn.close()

def create_embedding(text):
    """Crea un embedding per il testo fornito"""
    try:
        print("[DEBUG] Creating embedding for text")
        # Usa il modello per creare l'embedding
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embedding = model.encode(text)
        print(f"[DEBUG] Successfully created embedding of size {embedding.shape}")
        return embedding
    except Exception as e:
        print(f"[ERROR] Error creating embedding: {str(e)}")
        raise

@app.route('/get_rag_documents')
@login_required
def get_rag_documents():
    """Ottiene la lista dei documenti nella knowledge base"""
    db_path = get_user_db_path(session.get('username'))
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Ottieni tutti i documenti elaborati
    cursor.execute('''
    SELECT id, filename, file_type, size, upload_date FROM rag_documents 
    WHERE processed = 1
    ''')
    
    documents = cursor.fetchall()
    conn.close()
    
    # Formatta i risultati
    document_list = []
    for doc_id, filename, file_type, size, upload_date in documents:
        document_list.append({
            'id': doc_id,
            'filename': filename,
            'type': file_type,
            'size': size,
            'upload_date': upload_date
        })
    
    return jsonify({'success': True, 'documents': document_list}), 200

@app.route('/delete_rag_document/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_rag_document(doc_id):
    """Elimina un documento dalla knowledge base"""
    db_path = get_user_db_path(session.get('username'))
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Ottieni il percorso del file e dell'embedding
    cursor.execute('''
    SELECT file_path, embedding_path FROM rag_documents 
    WHERE id = ?
    ''', (doc_id,))
    
    result = cursor.fetchone()
    if not result:
        conn.close()
        return jsonify({'success': False, 'error': 'Documento non trovato'}), 404
    
    file_path, embedding_path = result
    
    # Elimina il file se esiste
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    
    # Elimina l'embedding se esiste
    if embedding_path and os.path.exists(embedding_path):
        os.remove(embedding_path)
    
    # Elimina il record dal database
    cursor.execute('''
    DELETE FROM rag_documents 
    WHERE id = ?
    ''', (doc_id,))
    
    conn.commit()
    
    # Controlla se la knowledge base è vuota
    cursor.execute('''
    SELECT COUNT(*) FROM rag_documents 
    WHERE processed = 1
    ''')
    
    count = cursor.fetchone()[0]
    empty_kb = count == 0
    
    conn.close()
    
    return jsonify({'success': True, 'empty_kb': empty_kb}), 200

@app.route('/clear_rag_knowledge_base', methods=['POST'])
@login_required
def clear_rag_knowledge_base():
    """Cancella l'intera knowledge base"""
    user_id = session.get('user_id')
    db_path = get_user_db_path(session.get('username'))
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Ottieni tutti i percorsi dei file e degli embedding
    cursor.execute('''
    SELECT file_path, embedding_path FROM rag_documents
    ''')
    
    paths = cursor.fetchall()
    
    # Elimina tutti i file e gli embedding
    for file_path, embedding_path in paths:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        
        if embedding_path and os.path.exists(embedding_path):
            os.remove(embedding_path)
    
    # Elimina tutti i record dal database
    cursor.execute('''
    DELETE FROM rag_documents
    ''')
    
    conn.commit()
    conn.close()
    
    # Elimina le directory se vuote
    user_rag_dir = os.path.join('user_data', str(user_id), 'rag_documents')
    user_embeddings_dir = os.path.join('user_data', str(user_id), 'rag_embeddings')
    
    try:
        if os.path.exists(user_rag_dir) and not os.listdir(user_rag_dir):
            os.rmdir(user_rag_dir)
        
        if os.path.exists(user_embeddings_dir) and not os.listdir(user_embeddings_dir):
            os.rmdir(user_embeddings_dir)
    except Exception as e:
        print(f"Errore nella pulizia delle directory: {str(e)}")
    
    return jsonify({'success': True}), 200

@app.route('/check_rag_knowledge_base')
@login_required
def check_rag_knowledge_base():
    """Controlla se esiste una knowledge base per l'utente"""
    db_path = get_user_db_path(session.get('username'))
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Controlla se esistono documenti elaborati
    cursor.execute('''
    SELECT COUNT(*) FROM rag_documents 
    WHERE processed = 1
    ''')
    
    try:
        count = cursor.fetchone()[0]
        exists = count > 0
    except:
        # La tabella potrebbe non esistere
        exists = False
    
    conn.close()
    
    return jsonify({'ready': exists}), 200

@app.route('/rag_chat', methods=['POST'])
@login_required
def rag_chat():
    """Gestisce le richieste di chat con la knowledge base"""
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Messaggio mancante'}), 400
    
    user_message = data['message']
    
    try:
        print("[DEBUG] Starting chat processing")
        # Crea l'embedding del messaggio dell'utente usando SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        query_embedding = model.encode(user_message)
        print("[DEBUG] Created query embedding")
        
        # Cerca i documenti più rilevanti
        db_path = get_user_db_path(session.get('username'))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, text_content, embedding_path FROM rag_documents WHERE embedding_path IS NOT NULL')
        documents = cursor.fetchall()
        conn.close()
        
        print(f"[DEBUG] Found {len(documents)} documents with embeddings")
        
        # Calcola la similarità con ogni documento
        similarities = []
        for doc_id, text_content, embedding_path in documents:
            try:
                doc_embedding = np.load(embedding_path)
                similarity = np.dot(query_embedding, doc_embedding) / (np.linalg.norm(query_embedding) * np.linalg.norm(doc_embedding))
                similarities.append((doc_id, text_content, similarity))
                print(f"[DEBUG] Calculated similarity for document {doc_id}: {similarity}")
            except Exception as e:
                print(f"[ERROR] Error calculating similarity for document {doc_id}: {str(e)}")
                continue
        
        # Ordina per similarità e prendi i primi 3 documenti
        similarities.sort(key=lambda x: x[2], reverse=True)
        top_docs = similarities[:3]
        
        print(f"[DEBUG] Selected top {len(top_docs)} documents")
        
        # Funzione per dividere il testo in chunks
        def split_text_into_chunks(text, max_chunk_size=4000):
            words = text.split()
            chunks = []
            current_chunk = []
            current_size = 0
            
            for word in words:
                current_chunk.append(word)
                current_size += len(word) + 1  # +1 per lo spazio
                
                if current_size >= max_chunk_size:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_size = 0
            
            if current_chunk:
                chunks.append(' '.join(current_chunk))
            
            return chunks
        
        # Prepara il contesto per il modello
        context_chunks = []
        for i, doc in enumerate(top_docs):
            doc_chunks = split_text_into_chunks(doc[1])
            for chunk in doc_chunks:
                context_chunks.append(f"Documento {i+1} (parte):\n{chunk}")
        
        # Se abbiamo troppi chunks, prendiamo solo i più rilevanti
        if len(context_chunks) > 3:
            context_chunks = context_chunks[:3]
        
        context = "\n\n".join(context_chunks)
        
        # Genera la risposta usando GPT-4 con streaming
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """Sei un assistente esperto che risponde alle domande basandosi sul contesto fornito. 
                Il tuo compito è:
                1. Analizzare attentamente i documenti forniti
                2. Rispondere alla domanda dell'utente basandoti SOLO sulle informazioni presenti nei documenti
                3. Se la risposta non può essere dedotta dal contesto, dillo chiaramente
                4. Se ci sono informazioni contraddittorie nei documenti, segnalalo
                5. Cita i documenti specifici quando possibile
                6. Fornisci risposte dettagliate e precise"""},
                {"role": "user", "content": f"Contesto:\n{context}\n\nDomanda: {user_message}"}
            ],
            temperature=0.7,
            max_tokens=2000,
            stream=True  # Abilita lo streaming
        )
        
        print("[DEBUG] Generated streaming response from GPT-4")

        def generate():
            for chunk in response:
                if chunk.choices[0].delta and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        
        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        print(f"[ERROR] Error in rag_chat: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Errore nella generazione della risposta'}), 500

