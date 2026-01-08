import './header.css'
import UserProfile from '../auth/UserProfile'

function Header() {
  return (
    <>
      <nav>
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/learn" style ={{padding: '10px'}}>Learn</a>
        </div>
        <UserProfile />
      </nav>
    </>
  )
}

export default Header
