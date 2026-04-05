import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import RightSidebar from './RightSidebar'

export default function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <RightSidebar />
    </div>
  )
}
