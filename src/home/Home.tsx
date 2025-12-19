import { useState } from 'react'
import './Home.css'
import Header from '../header/header.tsx'

interface SheetInfo {
  storageKey: string
  sessionId: string
}

function getSheetsFromLocalStorage(): SheetInfo[] {
  const sheets: SheetInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('spreadsheet_session_')) {
      // Extract the session ID by removing the 'spreadsheet_session_' prefix
      const sessionId = key.replace('spreadsheet_session_', '')
      sheets.push({
        storageKey: key,
        sessionId: sessionId
      })
    }
  }
  return sheets
}

function Home() {
  const [sheets, setSheets] = useState<SheetInfo[]>(getSheetsFromLocalStorage())

  const handleDelete = (storageKey: string) => {
    localStorage.removeItem(storageKey)
    // Update the UI by removing the deleted sheet from state
    setSheets(sheets.filter(sheet => sheet.storageKey !== storageKey))
  }

  return (
    <>
      <Header />
      <h1>Home</h1>
      <button>
          <a href="/sheets">New Sheet</a>
      </button>
      {sheets.map((sheet) => (
        <div key={sheet.storageKey}>
          <a href={`/sheets/${sheet.sessionId}`}>{sheet.sessionId}</a>
          <button onClick={() => handleDelete(sheet.storageKey)}>Delete</button>
        </div>
      ))}
    </>
  )
}

export default Home
