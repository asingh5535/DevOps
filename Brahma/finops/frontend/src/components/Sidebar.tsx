import { NavLink } from 'react-router-dom'
import {
  DashboardOutlined,
  DollarOutlined,
  SafetyOutlined,
  HddOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'

const links = [
  { to: '/dashboard', label: 'Overview', icon: <DashboardOutlined /> },
  { to: '/costs', label: 'Cost Analysis', icon: <DollarOutlined /> },
  { to: '/compliance', label: 'Label Compliance', icon: <SafetyOutlined /> },
  { to: '/resources', label: 'Resources', icon: <HddOutlined /> },
  { to: '/namespaces', label: 'Namespaces', icon: <AppstoreOutlined /> },
]

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  color: 'rgba(255,255,255,0.65)',
  textDecoration: 'none',
  borderRadius: 6,
  margin: '2px 8px',
  fontSize: 14,
  transition: 'all 0.2s',
}

const activeStyle: React.CSSProperties = {
  ...navStyle,
  background: '#1677ff',
  color: '#fff',
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>FinOps</h2>
        <span>Local K8s Cost Manager</span>
      </div>
      <nav style={{ padding: '12px 0', flex: 1 }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => (isActive ? activeStyle : navStyle)}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          docker-desktop cluster
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
          FinOps v1.0.0
        </div>
      </div>
    </aside>
  )
}
