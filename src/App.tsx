import { Routes, Route, Navigate } from "react-router-dom";
import './App.css'
import Home from './home/Home.tsx'
import Sheets from './sheets/Sheets.tsx'
import Learn from './learn/learn.tsx'
import Notes from './notes/notes.tsx'
import Login from './auth/Login.tsx'
import Register from './auth/Register.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes - require authentication */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/sheets" element={<ProtectedRoute><Sheets /></ProtectedRoute>} />
        <Route path="/sheets/:sessionId" element={<ProtectedRoute><Sheets /></ProtectedRoute>} />
        <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
        <Route path="/learn/:sessionId" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
        <Route path="/notes/:sessionId" element={<ProtectedRoute><Notes /></ProtectedRoute>} />

        <Route
          path="*"
          element={<Navigate to="/" replace={true} />}
        />
      </Routes>
    </AuthProvider>
  )
}

export default App
