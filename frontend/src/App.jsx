// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import RegressionPage from './pages/RegressionPage';
// Importa la nuova pagina
import ImageGeneratorPage from './pages/ImageGeneratorPage'; // <-- NUOVO IMPORT

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
          {/* Assicurati che il wrapper ProtectedRoute sia configurato correttamente */}
          <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/regression" element={<RegressionPage />} />
                <Route path="/image-generator" element={<ImageGeneratorPage />} /> {/* <-- NUOVA ROUTE */}
             </Route>

          {/* Fallback route */}
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </main>
      <footer className="bg-gray-800 text-white text-center p-4 mt-auto">
        © {new Date().getFullYear()} PL-AI Platform
      </footer>
    </div>
  );
}

export default App;