// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ImageGeneratorPage from './pages/ImageGeneratorPage';
import ResourceManagerPage from './pages/ResourceManagerPage';
import ImageClassifierPage from './pages/ImageClassifierPage';
import DataAnalysisPage from './pages/DataAnalysisPage';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/image-generator" element={<ImageGeneratorPage />} />
                <Route path="/resources" element={<ResourceManagerPage />} />
                <Route path="/image-classifier" element={<ImageClassifierPage />} />
                <Route path="/data-analysis" element={<DataAnalysisPage />} />
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
      <footer className="bg-gray-800 text-white text-center p-4 mt-auto">
        © {new Date().getFullYear()} PL-AI Platform
      </footer>
    </div>
  );
}
export default App;