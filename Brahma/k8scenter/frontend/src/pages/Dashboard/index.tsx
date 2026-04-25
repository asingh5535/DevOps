import React, { useEffect, useState } from 'react'
import {
  Row, Col, Card, Statistic, Progress, Typography, Spin, Alert,
  List, Tag, Badge, Space,
} from 'antd'
import {
  ClusterOutlined, ContainerOutlined, DeploymentUnitOutlined,
  ApiOutlined, DatabaseOutlined, WarningOutlined,
} from '@ant-design/icons'
import { clusterApi, eventApi } from '@/services/api'
import type { ClusterOverview, KubeEvent, KubeList } from '@/types'
import { formatAge, labelColor } from '@/utils'

const { Title, Text } = Typography

export default function Dashboard() {
  const [overview, setOverview] = useState<ClusterOverview | null>(null)
  const [events, setEvents] = useState<KubeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      clusterApi.overview(),
      eventApi.listEvents(),
    ]).then(([ov, ev]) => {
      setOverview(ov.data)
      const evList = ev.data as KubeList<KubeEvent>
      // Show latest warning events first
      const sorted = [...evList.items].sort((a, b) => {
        const aTime = new Date(a.lastTimestamp ?? a.metadata.creationTimestamp ?? 0).getTime()
        const bTime = new Date(b.lastTimestamp ?? b.metadata.creationTimestamp ?? 0).getTime()
        return bTime - aTime
      })
      setEvents(sorted.slice(0, 20))
    }).catch((err) => {
      setError(err?.response?.data?.error ?? 'Failed to load dashboard')
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <Spin size="large" />
      <div style={{ color: '#8b949e', marginTop: 16 }}>Loading cluster data...</div>
    </div>
  )

  if (error) return <Alert message={error} type="error" showIcon />

  if (!overview) return null

  const podRunningPct = overview.pods.total > 0
    ? Math.round((overview.pods.running / overview.pods.total) * 100) : 0
  const nodeReadyPct = overview.nodes.total > 0
    ? Math.round((overview.nodes.ready / overview.nodes.total) * 100) : 0

  const warningEvents = events.filter((e) => e.type === 'Warning')

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24, borderRadius: 8 }}>
        <Title level={3} style={{ margin: 0, color: '#e6edf3' }}>
          Cluster Dashboard
        </Title>
        <Text style={{ color: '#8b949e' }}>
          {overview.server_version} — All namespaces
        </Text>
      </div>

      {/* Warning banner */}
      {warningEvents.length > 0 && (
        <Alert
          message={`${warningEvents.length} warning event${warningEvents.length > 1 ? 's' : ''} in your cluster`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 24 }}
          closable
        />
      )}

      {/* Stat cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ background: '#161b22', border: '1px solid #21262d' }}>
            <Statistic
              title={<Text style={{ color: '#8b949e' }}>Nodes</Text>}
              value={overview.nodes.ready}
              suffix={`/ ${overview.nodes.total}`}
              prefix={<ClusterOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: overview.nodes.not_ready > 0 ? '#ff4d4f' : '#52c41a' }}
            />
            <Progress
              percent={nodeReadyPct}
              strokeColor={nodeReadyPct === 100 ? '#52c41a' : '#faad14'}
              showInfo={false}
              style={{ marginTop: 8 }}
            />
            <Text style={{ color: '#8b949e', fontSize: 12 }}>{overview.nodes.not_ready} not ready</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ background: '#161b22', border: '1px solid #21262d' }}>
            <Statistic
              title={<Text style={{ color: '#8b949e' }}>Pods</Text>}
              value={overview.pods.running}
              suffix={`/ ${overview.pods.total}`}
              prefix={<ContainerOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#e6edf3' }}
            />
            <Progress
              percent={podRunningPct}
              strokeColor="#52c41a"
              showInfo={false}
              style={{ marginTop: 8 }}
            />
            <Space size={8} style={{ marginTop: 2 }}>
              {overview.pods.pending > 0 && (
                <Tag color="gold" style={{ fontSize: 11 }}>{overview.pods.pending} pending</Tag>
              )}
              {overview.pods.failed > 0 && (
                <Tag color="red" style={{ fontSize: 11 }}>{overview.pods.failed} failed</Tag>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ background: '#161b22', border: '1px solid #21262d' }}>
            <Statistic
              title={<Text style={{ color: '#8b949e' }}>Deployments</Text>}
              value={overview.deployments}
              prefix={<DeploymentUnitOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#e6edf3' }}
            />
            <div style={{ marginTop: 16 }}>
              <Statistic
                title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Services</Text>}
                value={overview.services}
                prefix={<ApiOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#e6edf3', fontSize: 20 }}
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ background: '#161b22', border: '1px solid #21262d' }}>
            <Statistic
              title={<Text style={{ color: '#8b949e' }}>Namespaces</Text>}
              value={overview.namespaces}
              prefix={<DatabaseOutlined style={{ color: '#13c2c2' }} />}
              valueStyle={{ color: '#e6edf3' }}
            />
            <div style={{ marginTop: 16 }}>
              <Statistic
                title={<Text style={{ color: '#8b949e', fontSize: 12 }}>PVCs</Text>}
                value={overview.pvcs}
                valueStyle={{ color: '#e6edf3', fontSize: 20 }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Pod phase breakdown */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card
            title="Pod Status Breakdown"
            style={{ background: '#161b22', border: '1px solid #21262d' }}
            styles={{ header: { borderBottom: '1px solid #21262d', color: '#e6edf3' } }}
          >
            {[
              { label: 'Running', value: overview.pods.running, color: '#52c41a' },
              { label: 'Pending', value: overview.pods.pending, color: '#faad14' },
              { label: 'Succeeded', value: overview.pods.succeeded, color: '#1677ff' },
              { label: 'Failed', value: overview.pods.failed, color: '#ff4d4f' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 80, color: '#8b949e', fontSize: 13 }}>{item.label}</div>
                <Progress
                  percent={overview.pods.total > 0 ? Math.round(item.value / overview.pods.total * 100) : 0}
                  strokeColor={item.color}
                  style={{ flex: 1, marginBottom: 0 }}
                  format={() => <span style={{ color: '#e6edf3' }}>{item.value}</span>}
                />
              </div>
            ))}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                Recent Events
              </Space>
            }
            style={{ background: '#161b22', border: '1px solid #21262d' }}
            styles={{ header: { borderBottom: '1px solid #21262d', color: '#e6edf3' } }}
          >
            <List
              size="small"
              dataSource={events.slice(0, 10)}
              renderItem={(event) => (
                <List.Item style={{ borderBottom: '1px solid #21262d', padding: '8px 0' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Space size={8}>
                        <Badge
                          color={event.type === 'Warning' ? 'orange' : 'green'}
                          text={
                            <Text style={{ color: '#cdd9e5', fontSize: 13 }}>
                              {event.reason}
                            </Text>
                          }
                        />
                        <Tag style={{ fontSize: 10 }}>{event.involvedObject?.kind}</Tag>
                        <Text style={{ color: '#8b949e', fontSize: 12 }}>
                          {event.involvedObject?.name}
                        </Text>
                      </Space>
                      <Text style={{ color: '#8b949e', fontSize: 11 }}>
                        {formatAge(event.lastTimestamp ?? event.metadata.creationTimestamp)}
                      </Text>
                    </div>
                    <Text style={{ color: '#8b949e', fontSize: 12, display: 'block', marginTop: 2, paddingLeft: 14 }}>
                      {event.message}
                    </Text>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: <span style={{ color: '#8b949e' }}>No events</span> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
