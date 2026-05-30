import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';  // FIX #20
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    // FIX #20: top-level ErrorBoundary catches any unhandled render errors
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e1e2e',
                color: '#cdd6f4',
                border: '1px solid #313244',
                borderRadius: '12px',
                fontFamily: "'DM Sans', sans-serif",
              },
              success: { iconTheme: { primary: '#a6e3a1', secondary: '#1e1e2e' } },
              error:   { iconTheme: { primary: '#f38ba8', secondary: '#1e1e2e' } },
            }}
          />
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"  element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin"     element={<ProtectedRoute requiredRole="admin"><Admin /></ProtectedRoute>} />
            <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
