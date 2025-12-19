import { useState } from 'react'
import './header.css'

function Header() {
  return (
    <>
      <nav>
        <a href="/">Home</a>
        
        <a href="/sheets" style ={{padding: '10px'}}>Sheets</a>

        <a href="/learn" style ={{padding: '0px'}}>Learn</a>
      </nav>
    </>
  )
}

export default Header
