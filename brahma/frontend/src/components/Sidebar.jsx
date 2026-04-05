import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',             icon: '🏠', label: 'Home' },
  { to: '/explore',      icon: '🔍', label: 'Explore' },
  { to: '/notifications',icon: '🔔', label: 'Notifications' },
  { to: '/messages',     icon: '✉️',  label: 'Messages' },
  { to: '/bookmarks',    icon: '🔖', label: 'Bookmarks' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">𝕭</div>

      {NAV.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}

      <NavLink
        to={`/${user?.handle}`}
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </NavLink>

      <button className="tweet-btn" onClick={() => document.getElementById('compose-modal')?.showModal()}>
        Tweet
      </button>

      <div className="sidebar-user" onClick={() => navigate(`/${user?.handle}`)}>
        <img
          src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.handle}`}
          alt={user?.username}
          className="avatar"
        />
        <div className="sidebar-user-info">
          <span className="user-name">{user?.username}</span>
          <span className="user-handle">@{user?.handle}</span>
        </div>
        <button className="logout-btn" onClick={e => { e.stopPropagation(); handleLogout() }} title="Logout">
          ↩
        </button>
      </div>
    </nav>
  )
}
