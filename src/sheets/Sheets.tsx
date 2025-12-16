import { useState } from 'react'
import './Sheets.css'

function Sheets() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1> QuiL</h1>
      <button>Create Set</button>
    </>
  )
}

export default Sheets
