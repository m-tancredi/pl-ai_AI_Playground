# 🚀 Checklist di Verifica Post-Deployment - AI PlayGround Golinelli

## 📋 Verifica Infrastructure

### ✅ Sistema Base
- [ ] VPS Ionos operativa e accessibile
- [ ] Utente `aiplayground` configurato correttamente
- [ ] Docker e Docker Compose installati e funzionanti
- [ ] Nginx installato e configurato
- [ ] Certbot installato per SSL
- [ ] Git installato per clonazione repository

### ✅ Directory e Permessi
- [ ] Directory `/opt/golinelli-ai` creata con permessi corretti
- [ ] Volumi Docker creati in `/opt/golinelli-ai/volumes/`
- [ ] Directory media nginx create in `/opt/golinelli-ai/media_*`
- [ ] Permessi corretti per utente `aiplayground`

## 🔐 Verifica Sicurezza

### ✅ SSL/TLS
- [ ] Certificato SSL per `dev.pl-ai.it` installato
- [ ] Redirect HTTP -> HTTPS funzionante
- [ ] Test SSL: `curl -I https://dev.pl-ai.it`
- [ ] Verifica certificato: `openssl s_client -connect dev.pl-ai.it:443`

### ✅ Secrets e Configurazioni
- [ ] File `.secrets/` creati con API keys
- [ ] Permessi 600 sui file secrets
- [ ] Password database generate automaticamente
- [ ] Django secret key generata e sicura
- [ ] JWT secret key configurata

## 🐳 Verifica Docker

### ✅ Container Status
```bash
# Verifica che tutti i container siano in esecuzione
docker-compose ps

# Verifica salute dei container
docker-compose ps --filter "health=healthy"
```

- [ ] `golinelli-ai-auth-db` - healthy
- [ ] `golinelli-ai-user-db` - healthy  
- [ ] `golinelli-ai-chatbot-db` - healthy
- [ ] `golinelli-ai-image-generator-db` - healthy
- [ ] `golinelli-ai-resource-db` - healthy
- [ ] `golinelli-ai-classifier-db` - healthy
- [ ] `golinelli-ai-analysis-db` - healthy
- [ ] `golinelli-ai-rag-db` - healthy
- [ ] `golinelli-ai-learning-db` - healthy
- [ ] `golinelli-ai-rabbitmq` - healthy
- [ ] `golinelli-ai-auth-service` - healthy
- [ ] `golinelli-ai-user-service` - healthy
- [ ] `golinelli-ai-chatbot-service` - healthy
- [ ] `golinelli-ai-image-generator-service` - healthy
- [ ] `golinelli-ai-resource-manager-service` - healthy
- [ ] `golinelli-ai-classifier-service` - healthy
- [ ] `golinelli-ai-data-analysis-service` - healthy
- [ ] `golinelli-ai-rag-service` - healthy
- [ ] `golinelli-ai-learning-service` - healthy
- [ ] `golinelli-ai-frontend` - up
- [ ] `golinelli-ai-nginx` - up

### ✅ Worker Services
- [ ] `golinelli-ai-rag-worker` - up
- [ ] `golinelli-ai-data-analysis-worker` - up
- [ ] `golinelli-ai-classifier-worker` - up
- [ ] `golinelli-ai-resource-worker` - up

## 🌐 Verifica Nginx

### ✅ Configurazione Nginx
```bash
# Test configurazione nginx
sudo nginx -t

# Verifica status nginx
sudo systemctl status nginx

# Verifica porta 8081
sudo netstat -tlnp | grep :8081
```

- [ ] Configurazione nginx valida
- [ ] Nginx in esecuzione
- [ ] Porta 8081 aperta e in ascolto
- [ ] Configurazione `dev.pl-ai.it` attiva

### ✅ Coesistenza Siti
- [ ] `twinelib.it` ancora funzionante
- [ ] `blackix.it` ancora funzionante
- [ ] `dev.pl-ai.it` funzionante
- [ ] Nessun conflitto di porte

## 🔍 Verifica API Endpoints

### ✅ Test Connettività Base
```bash
# Test sito principale
curl -I https://dev.pl-ai.it

# Test API di base
curl -I https://dev.pl-ai.it/api/v1/
```

- [ ] Sito principale raggiungibile (200 OK)
- [ ] API endpoint raggiungibili

### ✅ Test Servizi Individuali
```bash
# Auth Service
curl -I https://dev.pl-ai.it/api/v1/auth/

# User Service  
curl -I https://dev.pl-ai.it/api/users/

# Chatbot Service
curl -I https://dev.pl-ai.it/api/chatbot/

# Image Generator Service
curl -I https://dev.pl-ai.it/api/images/

# Resource Manager Service
curl -I https://dev.pl-ai.it/api/resources/

# Image Classifier Service
curl -I https://dev.pl-ai.it/api/classifier/

# Data Analysis Service
curl -I https://dev.pl-ai.it/api/analysis/

# RAG Service
curl -I https://dev.pl-ai.it/api/rag/

# Learning Service
curl -I https://dev.pl-ai.it/api/learning-service/
```

- [ ] Auth Service risponde
- [ ] User Service risponde
- [ ] Chatbot Service risponde
- [ ] Image Generator Service risponde
- [ ] Resource Manager Service risponde
- [ ] Image Classifier Service risponde
- [ ] Data Analysis Service risponde
- [ ] RAG Service risponde
- [ ] Learning Service risponde

## 🗄️ Verifica Database

### ✅ Connessioni Database
```bash
# Verifica connessioni ai database
for service in auth_service user_service chatbot_service image_generator_service resource_manager_service image_classifier_service data_analysis_service rag_service learning_service; do
    echo "Testing $service database connection..."
    docker-compose exec $service python manage.py dbshell --command="SELECT 1;"
done
```

- [ ] Tutti i database raggiungibili
- [ ] Migrazioni applicate correttamente
- [ ] Tabelle create correttamente

### ✅ Verifica Volumi
```bash
# Verifica volumi persistenti
docker volume ls | grep golinelli-ai

# Verifica spazio su disco
df -h /opt/golinelli-ai/volumes/
```

- [ ] Volumi Docker creati
- [ ] Spazio disco sufficiente
- [ ] Backup automatici configurati

## 📊 Verifica Monitoraggio

### ✅ Logs
```bash
# Verifica logs dei servizi
docker-compose logs --tail=50 auth_service
docker-compose logs --tail=50 user_service
docker-compose logs --tail=50 frontend
docker-compose logs --tail=50 nginx

# Verifica logs nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

- [ ] Logs dei servizi puliti (no errori critici)
- [ ] Logs nginx puliti
- [ ] Logs rotativi configurati

### ✅ Performance
```bash
# Verifica utilizzo risorse
docker stats --no-stream
htop
```

- [ ] Utilizzo CPU accettabile (<70%)
- [ ] Utilizzo memoria accettabile (<80%)
- [ ] Utilizzo disco accettabile (<80%)

## 🎯 Verifica Funzionalità

### ✅ Frontend
- [ ] Pagina principale carica correttamente
- [ ] Login/registrazione funzionanti
- [ ] Navigazione tra pagine fluida
- [ ] Responsive design su mobile

### ✅ Autenticazione
- [ ] Login locale funzionante
- [ ] Login Google (se configurato)
- [ ] Logout funzionante
- [ ] Token JWT validi

### ✅ Servizi AI
- [ ] Chatbot risponde ai messaggi
- [ ] Generazione immagini funzionante
- [ ] Analisi dati operativa
- [ ] Sistema RAG funzionante
- [ ] Learning service operativo

### ✅ File Upload
- [ ] Upload file funzionante
- [ ] File serviti correttamente tramite nginx
- [ ] Permissions corretti su file media

## 🚨 Verifica Backup e Recovery

### ✅ Backup
```bash
# Test backup database
./backup.sh

# Verifica backup files
ls -la /opt/pl-ai/backups/
```

- [ ] Script backup funzionante
- [ ] Backup database creati
- [ ] Backup file media creati
- [ ] Backup configurazioni creati

### ✅ Recovery
- [ ] Procedura di recovery documentata
- [ ] Test recovery su ambiente di test
- [ ] Rollback plan definito

## 📧 Notifiche e Allerta

### ✅ Monitoring
- [ ] Monitoraggio uptime configurato
- [ ] Allerte configurate per downtime
- [ ] Monitoraggio utilizzo risorse
- [ ] Notifiche errori critici

## 🔄 Verifica Aggiornamenti

### ✅ Maintenance
- [ ] Script di gestione funzionanti (`./manage.sh`)
- [ ] Procedure di update documentate
- [ ] Rollback plan testato
- [ ] Manutenzione programmata definita

---

## 📋 Checklist Finale

### ✅ Pre-Go-Live
- [ ] Tutti i test sopra superati
- [ ] Performance accettabili
- [ ] Sicurezza verificata
- [ ] Backup configurati
- [ ] Monitoraggio attivo
- [ ] Documentazione completa

### ✅ Post-Go-Live
- [ ] Sito pubblico e accessibile
- [ ] Utenti possono registrarsi e loggarsi
- [ ] Servizi AI funzionanti
- [ ] Nessun errore critico nei logs
- [ ] Performance monitorate per 24h
- [ ] Feedback utenti raccolti

---

## 🆘 Troubleshooting

### Problemi Comuni

**Container non si avvia:**
```bash
docker-compose logs [service_name]
docker-compose down && docker-compose up -d
```

**Nginx errore 502:**
```bash
sudo nginx -t
sudo systemctl reload nginx
docker-compose ps
```

**Database non raggiungibile:**
```bash
docker-compose exec [service_name] python manage.py dbshell
docker-compose restart [db_service]
```

**SSL non funziona:**
```bash
sudo certbot renew --dry-run
sudo systemctl reload nginx
```

---

## 📞 Contatti di Supporto

- **Sistema**: `aiplayground@dev.pl-ai.it`
- **Database**: DBA Team
- **Networking**: Network Team
- **Sicurezza**: Security Team

---

**Data ultimo aggiornamento:** $(date)
**Versione deployment:** 1.0.0
**Responsabile:** AI PlayGround Team 