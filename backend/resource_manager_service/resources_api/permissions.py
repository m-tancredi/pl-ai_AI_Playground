# pl-ai/backend/resource_manager_service/resources_api/permissions.py

from rest_framework import permissions
from django.conf import settings
import hmac # Assicurati che hmac sia importato

class AllowInternalOnly(permissions.BasePermission):
    """
    Permette l'accesso solo se l'header segreto interno è presente e valido.
    """
    message = 'Invalid or missing internal authentication token.'

    def has_permission(self, request, view):
        # Leggi il segreto atteso dalle impostazioni (letto da env/secret)
        expected_secret = settings.INTERNAL_API_SECRET_VALUE
        # Leggi l'header inviato dalla richiesta
        header_name = settings.INTERNAL_API_SECRET_HEADER_NAME
        provided_secret = request.headers.get(header_name)

        # --- DEBUG: Stampa i valori ---
        print(f"\n--- Internal Permission Check ---")
        print(f"DEBUG: Expected Secret read from settings ('INTERNAL_API_SECRET_VALUE'): '{expected_secret}'")
        print(f"DEBUG: Header searched: '{header_name}'")
        print(f"DEBUG: Provided Secret received in header: '{provided_secret}'")
        # --- FINE DEBUG ---

        if not expected_secret:
            print("Permission Check Result: DENIED (Internal secret not configured on server)")
            print(f"--- End Internal Check ---\n")
            return False # Non permettere se il segreto non è configurato

        if provided_secret is None:
             print("Permission Check Result: DENIED (No internal secret header provided)")
             print(f"--- End Internal Check ---\n")
             return False

        # Confronta in modo sicuro
        # Assicurati che entrambi siano stringhe prima di compararli con hmac
        if not isinstance(expected_secret, str) or not isinstance(provided_secret, str):
             print("Permission Check Result: DENIED (Type mismatch between expected and provided secrets)")
             print(f"--- End Internal Check ---\n")
             return False

        is_match = hmac.compare_digest(expected_secret, provided_secret)
        print(f"Permission Check Result: {'GRANTED' if is_match else 'DENIED'} (Secrets Match: {is_match})")
        print(f"--- End Internal Check ---\n")
        return is_match