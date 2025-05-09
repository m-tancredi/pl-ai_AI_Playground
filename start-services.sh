#!/bin/bash

# Definisci i servizi disponibili e una breve descrizione
# Aggiungi qui tutti i tuoi servizi come definiti nel docker-compose.yml
declare -A services_map
services_map=(
    ["auth"]="Auth Service (auth_service + auth_db)"
    ["regression"]="Regression Service (pl_ai_regression_service + [NO DB])" # Ricorda che regression_db è stato rimosso
    ["image_generator"]="Image Generator (pl_ai_image_generator_service + image_generator_db)"
    ["resource_manager"]="Resource Manager (resource_manager_service + resource_manager_worker + resource_db + rabbitmq)"
    ["frontend"]="Frontend (frontend)"
    ["nginx"]="Nginx Gateway"
    ["rabbitmq"]="RabbitMQ Broker (solo)"
    ["all"]="Tutti i servizi"
    ["core_backend"]="Tutti i Backend + DBs + RabbitMQ (SENZA Frontend/Nginx)"
    ["dev_full_stack"]="Tutti i Backend + DBs + RabbitMQ + Frontend + Nginx"
)

# Dipendenze implicite per alcuni gruppi
# Se scegli "resource_manager", anche "rabbitmq" e "resource_db" dovrebbero partire.
# Se scegli un servizio backend, probabilmente vuoi anche il suo DB (se lo ha).
# Lo script può essere reso più intelligente per gestire queste dipendenze,
# ma per ora lasciamo che l'utente scelga esplicitamente o usi i gruppi.

echo "Servizi disponibili per l'avvio:"
i=1
# Array per mappare l'indice numerico al nome del servizio tecnico
declare -a indexed_services
for key in "${!services_map[@]}"; do
    echo "  $i. ${services_map[$key]}"
    indexed_services[$i]=$key
    i=$((i+1))
done
echo "------------------------------------------"
echo "Inserisci i numeri dei servizi da avviare, separati da spazio (es. 1 3 5)."
echo "Oppure scegli un gruppo (es. 'all', 'core_backend')."
read -p "Servizi da avviare: " selection

# Array per i servizi Docker da avviare
services_to_start=()

# Processa la selezione
for choice in $selection; do
    # Controlla se è un numero (indice)
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -lt "$i" ]; then
        service_key=${indexed_services[$choice]}
    # Controlla se è un nome di gruppo/servizio diretto
    elif [ -n "${services_map[$choice]}" ]; then
        service_key=$choice
    else
        echo "Selezione non valida: $choice"
        continue
    fi

    echo "Hai selezionato: ${services_map[$service_key]}"

    case $service_key in
        auth)
            services_to_start+=("auth_service" "auth_db")
            ;;
        regression)
            services_to_start+=("pl_ai_regression_service")
            # Assicurati che le dipendenze come resource_manager siano attive se necessarie per le chiamate interne
            # Potresti voler aggiungere un prompt per avviare anche resource_manager
            ;;
        image_generator)
            services_to_start+=("pl_ai_image_generator_service" "image_generator_db")
            ;;
        resource_manager)
            services_to_start+=("resource_manager_service" "resource_manager_worker" "resource_db" "rabbitmq")
            ;;
        classifier) # Assumendo tu abbia aggiunto image_classifier_service
            services_to_start+=("image_classifier_service" "image_classifier_worker" "classifier_db" "rabbitmq")
            ;;
        frontend)
            services_to_start+=("frontend")
            ;;
        nginx)
            services_to_start+=("nginx")
            ;;
        rabbitmq)
            services_to_start+=("rabbitmq")
            ;;
        all | dev_full_stack)
            # Aggiunge TUTTI i servizi definiti nel compose
            # Questo comando estrae i nomi dei servizi dal docker-compose.yml
            # Potrebbe essere più semplice elencarli manualmente per evitare sorprese
            # services_to_start=($(docker-compose config --services))
            services_to_start+=("auth_service" "auth_db" "pl_ai_regression_service" "pl_ai_image_generator_service" "image_generator_db" "resource_manager_service" "resource_manager_worker" "resource_db" "image_classifier_service" "image_classifier_worker" "classifier_db" "rabbitmq" "frontend" "nginx")
            break # Esce dal loop perché 'all' include tutto
            ;;
        core_backend)
            services_to_start+=("auth_service" "auth_db" "pl_ai_regression_service" "pl_ai_image_generator_service" "image_generator_db" "resource_manager_service" "resource_manager_worker" "resource_db" "image_classifier_service" "image_classifier_worker" "classifier_db" "rabbitmq")
            break
            ;;
        *)
            # Aggiunge il singolo servizio se non è un gruppo
            # Questo permette di scrivere direttamente il nome del servizio docker-compose
            if [[ " ${!services_map[@]} " =~ " ${service_key} " ]]; then
                 # Se è una chiave della mappa che non è un gruppo speciale, aggiungi il servizio corrispondente
                 # Questo blocco è ridondante con i case specifici, ma utile per estensibilità
                 # Esempio: se un servizio non ha dipendenze DB nel case, ma vuoi avviarlo da solo
                case $service_key in
                    # ... aggiungere casi specifici per servizi singoli se necessario per avviare solo quello...
                    # per ora, i gruppi e la selezione multipla dovrebbero coprire
                    *) echo "Servizio singolo '$service_key' non gestito individualmente senza le sue dipendenze DB/Broker. Usa i gruppi o selezioni multiple." ;;
                esac
            elif docker-compose config --services | grep -q "^${service_key}$"; then
                services_to_start+=("$service_key")
            else
                echo "Servizio non riconosciuto: $service_key"
            fi
            ;;
    esac
done

# Rimuovi duplicati
unique_services_to_start=($(echo "${services_to_start[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

if [ ${#unique_services_to_start[@]} -eq 0 ]; then
    echo "Nessun servizio valido selezionato. Uscita."
    exit 1
fi

echo "------------------------------------------"
echo "Servizi Docker che verranno avviati:"
for service in "${unique_services_to_start[@]}"; do
    echo "  - $service"
done
echo "------------------------------------------"

# Chiedi conferma
read -p "Vuoi procedere con l'avvio? (s/N): " confirm
if [[ "$confirm" != [sS] && "$confirm" != [yY] ]]; then
    echo "Avvio annullato."
    exit 0
fi

# Costruisci ed esegui il comando docker-compose
# L'opzione --build è opzionale, aggiungila se vuoi forzare la build
# L'opzione -d avvia in background
compose_command="docker-compose up -d"
# compose_command="docker-compose up --build -d" # Se vuoi buildare sempre

for service in "${unique_services_to_start[@]}"; do
    compose_command="$compose_command $service"
done

echo "Esecuzione comando: $compose_command"
eval $compose_command

echo "------------------------------------------"
echo "Per fermare i servizi, usa: docker-compose stop ${unique_services_to_start[*]}"
echo "Per fermare e rimuovere, usa: docker-compose down"
echo "Per vedere i log: docker-compose logs -f ${unique_services_to_start[*]}"