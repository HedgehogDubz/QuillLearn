import { Routes, Route, Navigate } from "react-router-dom";
import './App.css'
import Home from './home/Home.tsx'
import Sheets from './sheets/Sheets.tsx'
import Learn from './learn/learn.tsx'
import Notes from './notes/notes.tsx'
import Login from './auth/Login.tsx'
import Register from './auth/Register.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { ThemeProvider } from './theme/ThemeContext.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import Discover from './discover/Discover.tsx'
import PublicContent from './discover/PublicContent.tsx'
import Profile from './profile/Profile.tsx'

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Discover routes - public content browsing (requires login to interact) */}
        <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
        <Route path="/discover/content/:id" element={<ProtectedRoute><PublicContent /></ProtectedRoute>} />

        {/* Protected routes - require authentication */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/sheets" element={<ProtectedRoute><Sheets /></ProtectedRoute>} />
        <Route path="/sheets/:sessionId" element={<ProtectedRoute><Sheets /></ProtectedRoute>} />
        <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
        <Route path="/learn/:sessionId" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
        <Route path="/notes/:sessionId" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        <Route
          path="*"
          element={<Navigate to="/" replace={true} />}
        />
      </Routes>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App
