from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.conf import settings
import requests
from .serializers import ChatCompletionRequestSerializer, GenerateRequestSerializer

OLLAMA_BASE = settings.OLLAMA_API_BASE_URL

class ModelListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            r = requests.get(f"{OLLAMA_BASE}/api/tags")
            r.raise_for_status()
            data = r.json()
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ChatCompletionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        serializer = ChatCompletionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        try:
            r = requests.post(f"{OLLAMA_BASE}/api/chat", json=serializer.validated_data, timeout=120)
            r.raise_for_status()
            return Response(r.json())
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class GenerateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        serializer = GenerateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        try:
            r = requests.post(f"{OLLAMA_BASE}/api/generate", json=serializer.validated_data, timeout=120)
            r.raise_for_status()
            return Response(r.json())
        except Exception as e:
            return Response({"error": str(e)}, status=500) 