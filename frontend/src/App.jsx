// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserServicePage from './pages/UserServicePage';
import ImageGeneratorPage from './pages/ImageGeneratorPage';
import ResourceManagerPage from './pages/ResourceManagerPage';
import ImageClassifierPage from './pages/ImageClassifierPage';
import DataAnalysisPage from './pages/DataAnalysisPage';
import ChatbotServicePage from './pages/ChatbotServicePage';
import UnifiedRAGPage from './pages/UnifiedRAGPage';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 pt-28">
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes - Tutte le pagine dell'app richiedono autenticazione */}
          <Route element={<ProtectedRoute />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/profile" element={<UserServicePage />} />
                <Route path="/image-generator" element={<ImageGeneratorPage />} />
                <Route path="/resources" element={<ResourceManagerPage />} />
                <Route path="/image-classifier" element={<ImageClassifierPage />} />
                <Route path="/data-analysis" element={<DataAnalysisPage />} />
                <Route path="/chatbot" element={<ChatbotServicePage />} />
                <Route path="/rag" element={<UnifiedRAGPage />} />
                <Route path="/knowledge-bases" element={<UnifiedRAGPage />} />
             </Route>

          {/* Fallback route */}
          <Route path="*" element={
            <div className="text-center py-10">
              <h1 className="text-4xl font-bold text-red-600">404</h1>
              <p className="text-xl text-gray-700">Page Not Found</p>
            </div>
          } />
        </Routes>
      </main>
      
      {/* Footer with transparency effect */}
      <footer className="bg-white/90 backdrop-blur-md text-gray-700 py-0.5 w-full fixed bottom-0 border-t border-gray-200/50 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-6">
            <div className="flex-shrink-0 w-16">
              <img src="/LogoFG.png" alt="Fondazione Golinelli" className="h-5" />
            </div>
            <div className="text-center text-xs flex-grow">
              <p className="m-0">PL-AI è un prodotto di Fondazione Golinelli e G-lab srl Impresa Sociale -- tutti i diritti riservati.</p>
            </div>
            <div className="flex-shrink-0 w-16 flex justify-end">
              <img src="/G-LAB_logo.png" alt="G-lab" className="h-5" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;