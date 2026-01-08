/**
 * API Example Component
 * 
 * Demonstrates how to make API calls to the Express backend
 */

import { useState, useEffect } from 'react'
import './apiExample.css'

interface Note {
    id: number
    title: string
    content: string
    createdAt?: string
}

interface ApiResponse<T> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

function ApiExample() {
    const [notes, setNotes] = useState<Note[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newNote, setNewNote] = useState({ title: '', content: '' })

    // Fetch all notes
    const fetchNotes = async () => {
        setLoading(true)
        setError(null)
        
        try {
            const response = await fetch('/api/notes')
            const data: ApiResponse<Note[]> = await response.json()
            
            if (data.success && data.data) {
                setNotes(data.data)
            } else {
                setError(data.error || 'Failed to fetch notes')
            }
        } catch (err) {
            setError('Network error: ' + (err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    // Create a new note
    const createNote = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newNote)
            })

            const data: ApiResponse<Note> = await response.json()

            if (data.success) {
                setNewNote({ title: '', content: '' })
                fetchNotes() // Refresh the list
            } else {
                setError(data.error || 'Failed to create note')
            }
        } catch (err) {
            setError('Network error: ' + (err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    // Delete a note
    const deleteNote = async (id: number) => {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'DELETE'
            })

            const data: ApiResponse<null> = await response.json()

            if (data.success) {
                fetchNotes() // Refresh the list
            } else {
                setError(data.error || 'Failed to delete note')
            }
        } catch (err) {
            setError('Network error: ' + (err as Error).message)
        }
    }

    // Check API health
    const checkHealth = async () => {
        try {
            const response = await fetch('/api/health')
            const data = await response.json()
            alert(`API Status: ${data.status}\n${data.message}`)
        } catch (err) {
            alert('API is not responding')
        }
    }

    // Load notes on component mount
    useEffect(() => {
        fetchNotes()
    }, [])

    return (
        <div className="api_example_container">
            <h1>API Example</h1>
            
            <div className="api_actions">
                <button onClick={checkHealth} className="api_btn api_btn_secondary">
                    🏥 Check API Health
                </button>
                <button onClick={fetchNotes} className="api_btn api_btn_secondary">
                    🔄 Refresh Notes
                </button>
            </div>

            {error && <div className="api_error">{error}</div>}

            <div className="api_create_form">
                <h2>Create New Note</h2>
                <form onSubmit={createNote}>
                    <input
                        type="text"
                        placeholder="Note title"
                        value={newNote.title}
                        onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                        required
                    />
                    <textarea
                        placeholder="Note content"
                        value={newNote.content}
                        onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                        required
                    />
                    <button type="submit" className="api_btn api_btn_primary" disabled={loading}>
                        {loading ? 'Creating...' : '➕ Create Note'}
                    </button>
                </form>
            </div>

            <div className="api_notes_list">
                <h2>Notes ({notes.length})</h2>
                {loading && <p>Loading...</p>}
                {notes.map((note) => (
                    <div key={note.id} className="api_note_card">
                        <h3>{note.title}</h3>
                        <p>{note.content}</p>
                        <button 
                            onClick={() => deleteNote(note.id)} 
                            className="api_btn api_btn_danger"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ApiExample

