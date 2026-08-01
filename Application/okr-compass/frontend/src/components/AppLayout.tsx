import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Space } from 'antd'
import {
  DashboardOutlined, AimOutlined, ClusterOutlined, SettingOutlined,
  LogoutOutlined, UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/objectives', icon: <AimOutlined />, label: 'Objectives' },
  { key: '/clusters', icon: <ClusterOutlined />, label: 'Clusters' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, username } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const selectedKey = '/' + (location.pathname.split('/')[1] || 'dashboard')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{
          background: '#0d1117',
          borderRight: '1px solid #21262d',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div style={{
          padding: '16px', borderBottom: '1px solid #21262d',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            🧭
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                OKR Compass
              </div>
              <div style={{ color: '#8b949e', fontSize: 10 }}>Engineering OKR Platform</div>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#0d1117', borderRight: 0, paddingTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px', background: '#0d1117', borderBottom: '1px solid #21262d',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          position: 'sticky', top: 0, zIndex: 99, height: 56,
        }}>
          <Space size={16}>
            <Text style={{ color: '#8b949e', fontSize: 12 }}>{username}</Text>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'logout',
                    label: 'Log out',
                    icon: <LogoutOutlined />,
                    danger: true,
                    onClick: () => { logout(); navigate('/login') },
                  },
                ],
              }}
              placement="bottomRight"
            >
              <Avatar size={32} style={{ background: '#1677ff', cursor: 'pointer' }} icon={<UserOutlined />} />
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 24, background: '#0a0a0a', minHeight: 'calc(100vh - 56px)', overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
