import { Routes, Route, Navigate } from "react-router-dom";
import './App.css'
import Home from './home/Home.tsx'
import Sheets from './sheets/Sheets.tsx'
import Learn from './learn/learn.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sheets" element={<Sheets />} />
      <Route path="/sheets/:sessionId" element={<Sheets />} />
      <Route path="/learn" element={<Learn />} />
      <Route path="/learn/:sessionId" element={<Learn />} />
      <Route
        path="*"
        element={<Navigate to="/" replace={true} />}
      />
    </Routes>
  )
}

export default App
