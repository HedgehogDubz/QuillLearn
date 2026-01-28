import { Routes, Route, Navigate } from "react-router-dom";
import './App.css'
import Home from './home/Home.tsx'
import Sheets from './sheets/Sheets.tsx'
import Learn from './learn/learn.tsx'
import Notes from './notes/notes.tsx'
import DiagramEditor from './diagrams/DiagramEditor.tsx'
import DiagramLearn from './diagrams/DiagramLearn.tsx'
import Login from './auth/Login.tsx'
import Register from './auth/Register.tsx'
import ForgotPassword from './auth/ForgotPassword.tsx'
import ResetPassword from './auth/ResetPassword.tsx'
import VerifyEmail from './auth/VerifyEmail.tsx'
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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

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
        <Route path="/diagrams" element={<ProtectedRoute><DiagramEditor /></ProtectedRoute>} />
        <Route path="/diagrams/:sessionId" element={<ProtectedRoute><DiagramEditor /></ProtectedRoute>} />
        <Route path="/learn/diagram/:sessionId" element={<ProtectedRoute><DiagramLearn /></ProtectedRoute>} />
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
