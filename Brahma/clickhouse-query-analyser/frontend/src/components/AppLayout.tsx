import React, { useEffect, useState } from 'react'
import { Layout, Menu, Select, Typography, Badge, Space, Tag, Spin } from 'antd'
import {
  DashboardOutlined, ThunderboltOutlined, WarningOutlined, RocketOutlined,
  FileTextOutlined, CodeOutlined, ClusterOutlined, ScheduleOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { clustersApi, Cluster } from '../api/client'
import { useAppStore } from '../store'

const { Sider, Content, Header } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/slow-queries', icon: <ThunderboltOutlined />, label: 'Slow Queries' },
  { key: '/full-scans', icon: <WarningOutlined />, label: 'Full Scans' },
  { key: '/memory-hogs', icon: <RocketOutlined />, label: 'Memory Hogs' },
  { key: '/explain', icon: <CodeOutlined />, label: 'Query Explain' },
  { key: '/optimization', icon: <FileTextOutlined />, label: 'Optimization Guide' },
  { key: '/reports', icon: <ScheduleOutlined />, label: 'Reports' },
  { key: '/clusters', icon: <ClusterOutlined />, label: 'Clusters' },
]

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { clusters, setClusters, selectedCluster, setSelectedCluster } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clustersApi.list().then(r => {
      setClusters(r.data.clusters)
      if (!selectedCluster && r.data.clusters.length > 0) {
        setSelectedCluster(r.data.clusters[0].id)
      }
    }).finally(() => setLoading(false))
  }, [])

  const selected = clusters.find(c => c.id === selectedCluster)

  return (
    <Layout style={{ minHeight: '100vh', background: '#0d1117' }}>
      <Sider
        width={220}
        style={{ background: '#161b22', borderRight: '1px solid #30363d' }}
      >
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #30363d' }}>
          <Text style={{ color: '#f0883e', fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>
            Torres
          </Text>
          <br />
          <Text style={{ color: '#8b949e', fontSize: 11 }}>ClickHouse Query Analyser</Text>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
          <Text style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 6 }}>
            CLUSTER
          </Text>
          {loading ? <Spin size="small" /> : (
            <Select
              value={selectedCluster}
              onChange={setSelectedCluster}
              style={{ width: '100%' }}
              size="small"
              options={clusters.map(c => ({
                value: c.id,
                label: (
                  <Space size={4}>
                    <Badge
                      status={c.reachable === false ? 'error' : c.reachable ? 'success' : 'default'}
                      style={{ marginRight: 2 }}
                    />
                    <span style={{ fontSize: 12 }}>{c.name}</span>
                  </Space>
                ),
              }))}
            />
          )}
          {selected && (
            <Tag
              style={{ marginTop: 6, fontSize: 10 }}
              color={selected.type === 'kubernetes' ? 'blue' : 'purple'}
            >
              {selected.type === 'kubernetes' ? 'K8s' : 'Standalone'}
            </Tag>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            border: 'none',
            marginTop: 4,
          }}
          theme="dark"
        />
      </Sider>

      <Layout style={{ background: '#0d1117' }}>
        <Header style={{
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          lineHeight: '48px',
        }}>
          <Text style={{ color: '#e6edf3', fontSize: 14 }}>
            {menuItems.find(m => m.key === location.pathname)?.label ?? 'Torres CH Analyser'}
          </Text>
          <Space>
            <Text style={{ color: '#8b949e', fontSize: 12 }}>
              {clusters.length} clusters registered
            </Text>
            <Badge
              color="#238636"
              text={<Text style={{ color: '#3fb950', fontSize: 12 }}>Live</Text>}
            />
          </Space>
        </Header>

        <Content style={{ padding: 24, overflowY: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
