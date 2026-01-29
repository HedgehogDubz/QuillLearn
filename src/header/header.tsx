import './header.css'
import UserProfile from '../auth/UserProfile'
import ThemeToggle from '../theme/ThemeToggle'
import { useLocation } from 'react-router-dom'
import Logo from '../images/logo.png'
import { useState, useEffect } from 'react'

function Header() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.nav-mobile-menu') && !target.closest('.nav-hamburger')) {
        setMobileMenuOpen(false)
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      // Prevent body scrolling when menu is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <nav>
      <div className="nav-brand">
        <a href="/" className="nav-logo">
          <img src={Logo} alt="QuillLearn" className="nav-logo-img" />
        </a>
        <span className="nav-logo-text">Quill<span>Learn</span></span>
      </div>

      {/* Desktop navigation */}
      <div className="nav-links">
        <a href="/" className={isActive('/') ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </a>
        <a href="/learn" className={isActive('/learn') ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Learn
        </a>
        <a href="/discover" className={isActive('/discover') ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          Discover
        </a>
      </div>

      <div className="nav-right">
        <ThemeToggle />
        <UserProfile />

        {/* Hamburger menu button - mobile only */}
        <button
          className={`nav-hamburger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="nav-mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile navigation menu */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <a href="/" className={isActive('/') ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </a>
        <a href="/learn" className={isActive('/learn') ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Learn
        </a>
        <a href="/discover" className={isActive('/discover') ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          Discover
        </a>
      </div>
    </nav>
  )
}

export default Header
