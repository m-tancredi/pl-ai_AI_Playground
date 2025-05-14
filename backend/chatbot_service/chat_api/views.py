# pl-ai/backend/chatbot_service/chat_api/views.py
import json
from datetime import datetime
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.http import Http404 # Importa Http404 per sollevare eccezioni standard Django
import uuid

from rest_framework import viewsets, status, permissions, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import exceptions # Per DRF exceptions
from rest_framework import serializers # Per serializers.ValidationError

from .models import ChatbotProfile, Conversation, ChatMessage
from .serializers import (
    ChatbotProfileSerializer, ConversationSerializer, ChatMessageSerializer,
    SendMessageRequestSerializer, SendMessageResponseSerializer
)
from .authentication import JWTCustomAuthentication
# Assicurati che i client LLM e la funzione count_tokens siano importati correttamente
from .llm_clients import (
    openai_client, anthropic_client, genai, API_CLIENT_STATUS,
    count_tokens_for_openai, OpenAIAPIError, AnthropicAPIError # Importa anche gli errori specifici
)
from .rag_utils import get_document_content_from_resource_manager


class ChatbotProfileViewSet(viewsets.ModelViewSet):
    """API endpoint for managing user's Chatbot Profiles."""
    serializer_class = ChatbotProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    lookup_field = 'id'

    def get_queryset(self):
        # request.user è l'oggetto SimpleUser con l'ID
        return ChatbotProfile.objects.filter(owner_id=self.request.user.id).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(owner_id=self.request.user.id)


class ConversationViewSet(viewsets.ModelViewSet):
    """API endpoint for managing user's Conversations."""
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    lookup_field = 'id'

    def get_queryset(self):
        queryset = Conversation.objects.filter(owner_id=self.request.user.id)
        profile_id = self.request.query_params.get('profile_id')
        if profile_id:
            # Valida che profile_id sia un UUID valido se il campo nel modello lo è
            try:
                profile_uuid = uuid.UUID(profile_id)
                queryset = queryset.filter(profile_id=profile_uuid)
            except ValueError:
                # Ignora il filtro se non è un UUID valido o restituisci errore?
                # Per ora lo ignoriamo, ma potrebbe essere un 400 Bad Request.
                pass
        return queryset.order_by('-updated_at')

    def perform_create(self, serializer):
        profile_id_from_request = self.request.data.get('profile_id') # Prendi da request.data
        if not profile_id_from_request:
             raise serializers.ValidationError({"profile_id": "This field is required."})
        try:
            profile = ChatbotProfile.objects.get(pk=profile_id_from_request, owner_id=self.request.user.id)
        except ChatbotProfile.DoesNotExist:
            raise serializers.ValidationError({"profile_id": "ChatbotProfile not found or not owned by user."})
        serializer.save(owner_id=self.request.user.id, profile=profile)


class ChatMessageListView(generics.ListAPIView):
    """API endpoint to list messages for a specific conversation."""
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]
    # pagination_class = PageNumberPagination # Aggiungi se vuoi paginazione standard DRF

    def get_queryset(self):
        conversation_id = self.kwargs.get('conversation_pk')
        conversation = get_object_or_404(Conversation, pk=conversation_id, owner_id=self.request.user.id)
        return ChatMessage.objects.filter(conversation=conversation).order_by('timestamp')


class SendMessageView(APIView):
    """Handles sending a message to a conversation and getting an LLM response."""
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTCustomAuthentication]

    def _get_or_create_conversation(self, request, profile_id_str=None, conversation_id_str=None):
        user_id = request.user.id
        conversation, profile = None, None

        if conversation_id_str:
            # get_object_or_404 solleverà Http404 se non trovato, catturato dalla view
            conversation = get_object_or_404(Conversation, pk=conversation_id_str, owner_id=user_id)
            profile = conversation.profile
        elif profile_id_str:
            profile = get_object_or_404(ChatbotProfile, pk=profile_id_str, owner_id=user_id)
            # Crea una nuova conversazione
            # Titolo provvisorio, potrebbe essere aggiornato dal primo messaggio utente
            conversation = Conversation.objects.create(profile=profile, owner_id=user_id, title="New Chat")
            print(f"Created new conversation {conversation.id} for profile {profile.id} by user {user_id}")
        else:
            # Questo caso dovrebbe essere gestito dal serializer o dalla logica URL
            raise exceptions.ValidationError("Profile ID or Conversation ID (via URL) is required.")
        return conversation, profile

    def _prepare_llm_messages(self, conversation, user_content, chatbot_profile, rag_content=""):
        messages = []
        if chatbot_profile.system_prompt:
            messages.append({"role": "system", "content": chatbot_profile.system_prompt})
        if rag_content: # Aggiungi RAG context PRIMA della history
            messages.append({"role": "system", "content": f"Use the following document snippets as context for your answer:\n--- Snippets ---\n{rag_content}\n--- End Snippets ---"})

        history_messages = ChatMessage.objects.filter(conversation=conversation).order_by('-timestamp')[:settings.MAX_CONTEXT_MESSAGES]
        for msg in reversed(history_messages):
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_content})
        return messages

    def _call_llm(self, llm_model_name, messages_payload, current_profile):
        response_text, input_tokens, output_tokens, total_tokens = None, 0, 0, 0

            # --- AGGIUNGI DEBUG QUI ---
        print(f"--- _call_llm Debug ---")
        print(f"Requested model: {llm_model_name}")
        print(f"OpenAI Client Initialized: {API_CLIENT_STATUS['openai']}")
        print(f"OpenAI Client Object: {'Exists' if openai_client else 'None'}")
        if API_CLIENT_STATUS['error_messages'].get('openai'):
            print(f"OpenAI Init Error: {API_CLIENT_STATUS['error_messages']['openai']}")
        # Puoi aggiungere log simili per Anthropic e Gemini se necessario
        print(f"--- End _call_llm Debug ---")
    # --- FINE DEBUG ---
        print(f"Calling LLM: {llm_model_name} with {len(messages_payload)} messages in payload.")

        try:
            if llm_model_name.startswith("gpt") and openai_client and API_CLIENT_STATUS['openai']:
                input_tokens = count_tokens_for_openai(messages_payload, llm_model_name)
                completion = openai_client.chat.completions.create(
                    model=llm_model_name, messages=messages_payload,
                    temperature=0.7, max_tokens=1500
                )
                response_text = completion.choices[0].message.content
                if completion.usage:
                    input_tokens = completion.usage.prompt_tokens
                    output_tokens = completion.usage.completion_tokens
                    total_tokens = completion.usage.total_tokens
            elif llm_model_name.startswith("claude") and anthropic_client and API_CLIENT_STATUS['anthropic']:
                system_prompt_anthropic = current_profile.system_prompt # Prendi da profilo
                anthropic_messages = [msg for msg in messages_payload if msg['role'] != 'system'] # Rimuovi system da messages
                response = anthropic_client.messages.create(
                    model=llm_model_name, max_tokens=1500,
                    system=system_prompt_anthropic if system_prompt_anthropic else None,
                    messages=anthropic_messages, temperature=0.7
                )
                response_text = response.content[0].text
                if response.usage:
                    input_tokens = response.usage.input_tokens
                    output_tokens = response.usage.output_tokens
                    total_tokens = input_tokens + output_tokens
            elif llm_model_name.startswith("gemini") and API_CLIENT_STATUS['gemini']:
                gemini_history = []
                current_system_prompt_gemini = current_profile.system_prompt
                for msg in messages_payload: # Adatta a formato Gemini parts
                    if msg['role'] != 'system': # Gemini usa system_instruction
                        gemini_history.append({'role': msg['role'], 'parts': [{'text': msg['content']}]})

                model_instance = genai.GenerativeModel(
                    model_name=llm_model_name,
                    system_instruction=current_system_prompt_gemini if current_system_prompt_gemini else None
                )
                gemini_response = model_instance.generate_content(gemini_history)
                response_text = gemini_response.text
                # Conteggio token per Gemini è più complesso e potrebbe richiedere API separate
                # input_tokens = model_instance.count_tokens(gemini_history).total_tokens
                # output_tokens = model_instance.count_tokens(response_text).total_tokens
                # total_tokens = input_tokens + output_tokens
            else:
                error_msg = f"LLM model '{llm_model_name}' is not supported or its client is not initialized."
                if llm_model_name in API_CLIENT_STATUS['error_messages']:
                     error_msg += f" Initialization error: {API_CLIENT_STATUS['error_messages'][llm_model_name]}"
                raise exceptions.ValidationError(error_msg)

            if response_text is None:
                 raise exceptions.APIException("LLM did not return a response.", code=status.HTTP_503_SERVICE_UNAVAILABLE)

            token_info = {"input": input_tokens, "output": output_tokens, "total": total_tokens}
            # Calcola output tokens per OpenAI se API non li dà (vecchie versioni SDK)
            if not output_tokens and llm_model_name.startswith("gpt") and response_text:
                token_info["output"] = count_tokens_for_openai([{"role":"assistant", "content":response_text}], llm_model_name)
                token_info["total"] = token_info["input"] + token_info["output"]

            return response_text, token_info

        # Gestione errori specifici degli SDK LLM
        except OpenAIAPIError as e:
            print(f"OpenAI API Error: {e}")
            raise exceptions.APIException(f"OpenAI API error: {str(e)}", code=getattr(e, 'status_code', 503))
        except AnthropicAPIError as e:
            print(f"Anthropic API Error: {e}")
            raise exceptions.APIException(f"Anthropic API error: {str(e)}", code=getattr(e, 'status_code', 503))
        except Exception as e: # Per errori Gemini o altri non specifici
            print(f"General LLM call error for {llm_model_name}: {e}")
            # Includi traceback per debug
            import traceback
            traceback.print_exc()
            raise exceptions.APIException(f"Error with {llm_model_name} API: {str(e)}", code=status.HTTP_503_SERVICE_UNAVAILABLE)


    @transaction.atomic # Assicura che messaggio utente e assistente siano salvati insieme
    def post(self, request, conversation_pk=None, *args, **kwargs):
        # conversation_pk viene dall'URL pattern se presente
        serializer = SendMessageRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        user_content = validated_data['content']
        profile_id_from_body = validated_data.get('profile_id')
        rag_resource_ids = validated_data.get('rag_resource_ids', [])

        try:
            conversation, profile = self._get_or_create_conversation(
                request,
                profile_id_str=profile_id_from_body,
                conversation_id_str=conversation_pk
            )
        except Http404:
            return Response({"error": "Conversation or Profile not found for this user."}, status=status.HTTP_404_NOT_FOUND)
        except exceptions.ValidationError as e: # Da _get_or_create_conversation
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        # Aggiorna titolo conversazione se è il primo messaggio "reale"
        # (escludendo messaggi di avvio speciali)
        is_start_message = user_content.strip().upper() in ['START_INTERVIEW', 'START_INTERROGATION']
        if not conversation.title and user_content and not is_start_message:
            new_title = user_content[:75] + "..." if len(user_content) > 75 else user_content
            if conversation.title != new_title: # Evita save inutili
                conversation.title = new_title
                conversation.save(update_fields=['title'])

        # Salva messaggio utente
        user_message = ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.USER,
            content=user_content
        )

        # --- Logica Modalità ---
        rag_extracted_content = ""
        llm_to_use = profile.llm_model_name or settings.DEFAULT_LLM_MODEL_OPENAI

        if profile.mode == 'rag' and rag_resource_ids:
            print(f"RAG Mode: Fetching content for resources: {rag_resource_ids}")
            # Aggiorna gli ID RAG attivi sulla conversazione
            current_rag_ids = set(conversation.active_rag_resource_ids or [])
            current_rag_ids.update(rag_resource_ids) # Aggiunge i nuovi
            conversation.active_rag_resource_ids = sorted(list(current_rag_ids))
            # Salva subito per avere gli ID corretti se il task RAG fallisce
            conversation.save(update_fields=['active_rag_resource_ids', 'updated_at'])

            for res_id in rag_resource_ids:
                # TODO: Ottenere il mime_type della risorsa dal resource_manager per aiutare rag_utils
                # Per ora, rag_utils proverà a indovinarlo
                doc_text = get_document_content_from_resource_manager(res_id)
                if doc_text:
                    rag_extracted_content += f"\n\n--- Document Snippet (Resource ID: {res_id}) ---\n{doc_text[:settings.MAX_RAG_DOCUMENT_LENGTH]}\n--- End Snippet ---"

        elif profile.mode == 'intervista' and is_start_message:
            welcome_message = f"Ah, finalmente! Sono {profile.name or 'il personaggio misterioso'}, pronto per questa intervista. Cosa arde nel tuo cuore di sapere?"
            assistant_message_obj = ChatMessage.objects.create(
                conversation=conversation, role=ChatMessage.Role.ASSISTANT,
                content=welcome_message, llm_model_used=llm_to_use, token_info={"input":0, "output":0, "total":0}
            )
            conversation.updated_at = timezone.now(); conversation.save(update_fields=['updated_at'])
            return Response(SendMessageResponseSerializer({
                'user_message': ChatMessageSerializer(user_message).data,
                'assistant_message': ChatMessageSerializer(assistant_message_obj).data,
                'conversation_id': conversation.id
            }).data, status=status.HTTP_200_OK)

        elif profile.mode == 'interrogazione' and is_start_message:
            # Per l'interrogazione, il system prompt dovrebbe guidare l'AI a fare la prima domanda
            # Quindi, procediamo normalmente alla chiamata LLM
            pass

        # Prepara messaggi per LLM
        llm_messages = self._prepare_llm_messages(conversation, user_content, profile, rag_extracted_content)

        try:
            assistant_response_text, token_data = self._call_llm(llm_to_use, llm_messages, profile)
        except exceptions.APIException as e:
            return Response({"error": f"LLM API Error: {e.detail}"}, status=e.status_code if e.status_code else status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            print(f"Unexpected error during LLM call: {e}")
            import traceback; traceback.print_exc();
            return Response({"error": "Failed to get response from AI assistant."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Salva risposta assistente
        assistant_message_obj = ChatMessage.objects.create(
            conversation=conversation, role=ChatMessage.Role.ASSISTANT,
            content=assistant_response_text, llm_model_used=llm_to_use, token_info=token_data
        )

        # Aggiorna timestamp conversazione per ultimo
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])

        response_payload = {
            'user_message': ChatMessageSerializer(user_message).data,
            'assistant_message': ChatMessageSerializer(assistant_message_obj).data,
            'conversation_id': conversation.id
        }
        return Response(SendMessageResponseSerializer(response_payload).data, status=status.HTTP_200_OK)