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
import ImageGeneratorPage from './pages/ImageGeneratorPage';
import ResourceManagerPage from './pages/ResourceManagerPage';
import ImageClassifierPage from './pages/ImageClassifierPage';


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
                <Route path="/regression" element={<RegressionPage />} />
                <Route path="/image-generator" element={<ImageGeneratorPage />} />
                <Route path="/resources" element={<ResourceManagerPage />} />
                <Route path="/image-classifier" element={<ImageClassifierPage />} />
             </Route>

          {/* Fallback route */}
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </main>
      {/* ... Footer ... */}
    </div>
  );
}

export default App;