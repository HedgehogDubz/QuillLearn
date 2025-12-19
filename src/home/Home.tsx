import { useState } from 'react'
import './Home.css'
import Header from '../header/header.tsx'
import type { SheetInfo } from '../gaurdian.ts'
import ModeModal from '../mode/mode.tsx'

function getSheetsFromLocalStorage(): SheetInfo[] {
  const sheets: SheetInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('spreadsheet_session_')) {
      // Extract the session ID by removing the 'spreadsheet_session_' prefix
      const sessionId = key.replace('spreadsheet_session_', '')
      sheets.push({
        title: JSON.parse(localStorage.getItem(key) || '').title,
        storageKey: key,
        sessionId: sessionId
      })
    }
  }
  return sheets
}

function Home() {
  const [sheets, setSheets] = useState<SheetInfo[]>(getSheetsFromLocalStorage())
  const [selectedSheet, setSelectedSheet] = useState<SheetInfo | null>(null)

  const handleDelete = (e: React.MouseEvent, storageKey: string) => {
    e.stopPropagation() // Prevent opening the modal when clicking delete
    localStorage.removeItem(storageKey)
    // Update the UI by removing the deleted sheet from state
    setSheets(sheets.filter(sheet => sheet.storageKey !== storageKey))
  }

  const handleSheetClick = (sheet: SheetInfo) => {
    setSelectedSheet(sheet)
  }

  const handleCloseModal = () => {
    setSelectedSheet(null)
  }

  return (
    <>
      <Header />
      <h1>Home</h1>
      <button>
          <a href="/sheets">New Sheet</a>
      </button>
      {sheets.map((sheet) => (
        <div key={sheet.storageKey} className="home_sheet_item">
          <span
            className="home_sheet_link"
            onClick={() => handleSheetClick(sheet)}
          >
            {sheet.title}
          </span>
          <button onClick={(e) => handleDelete(e, sheet.storageKey)}>Delete</button>
        </div>
      ))}

      {selectedSheet && (
        <ModeModal
          sessionId={selectedSheet.sessionId}
          title={selectedSheet.title}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}

export default Home
