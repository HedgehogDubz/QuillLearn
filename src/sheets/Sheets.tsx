import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './Sheets.css'
import Header from '../header/header.tsx'
import InputGrid from './InputGrid.tsx'
import { updateLastAccessed } from './sheetStorage.ts'

function Sheets() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // If no session ID in URL, generate one and redirect
    if (!sessionId) {
      const newSessionId = crypto.randomUUID();
      navigate(`/sheets/${newSessionId}`, { replace: true });
    } else {
      // Update lastTimeSaved when opening the sheet
      updateLastAccessed(sessionId);
    }
  }, [sessionId, navigate]);

  // Don't render InputGrid until we have a session ID
  if (!sessionId) {
    return null;
  }

  return (
    <>
      <Header />
      <h1> Sheets</h1>
      <InputGrid sessionId={sessionId} />
    </>
  )
}

export default Sheets
