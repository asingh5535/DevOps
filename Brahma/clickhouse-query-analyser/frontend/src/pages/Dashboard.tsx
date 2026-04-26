import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Badge, Typography, Spin, Alert, Space } from 'antd'
import {
  ThunderboltOutlined, WarningOutlined, RocketOutlined, CheckCircleOutlined,
  CloseCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons'
import { clustersApi, queriesApi, Cluster, ClusterStats } from '../api/client'
import { useAppStore } from '../store'

const { Text, Title } = Typography

const statusBadge = (reachable?: boolean) => {
  if (reachable === true) return <Badge status="success" text={<Text style={{ color: '#3fb950', fontSize: 12 }}>Active</Text>} />
  if (reachable === false) return <Badge status="error" text={<Text style={{ color: '#f85149', fontSize: 12 }}>Unreachable</Text>} />
  return <Badge status="default" text={<Text style={{ color: '#8b949e', fontSize: 12 }}>Unknown</Text>} />
}

const Dashboard: React.FC = () => {
  const { clusters, setClusters, selectedCluster } = useAppStore()
  const [stats, setStats] = useState<ClusterStats | null>(null)
  const [healthMap, setHealthMap] = useState<Record<string, Cluster>>({})
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingHealth, setLoadingHealth] = useState(false)

  useEffect(() => {
    setLoadingHealth(true)
    clustersApi.list().then(r => {
      setClusters(r.data.clusters)
      // check health for each
      r.data.clusters.forEach(cl => {
        clustersApi.health(cl.id).then(hr => {
          setHealthMap(prev => ({ ...prev, [cl.id]: hr.data }))
        }).catch(() => {
          setHealthMap(prev => ({ ...prev, [cl.id]: { ...cl, reachable: false } }))
        })
      })
    }).finally(() => setLoadingHealth(false))
  }, [])

  useEffect(() => {
    if (!selectedCluster) return
    setLoadingStats(true)
    queriesApi.stats(selectedCluster, 24).then(r => setStats(r.data)).catch(() => setStats(null)).finally(() => setLoadingStats(false))
  }, [selectedCluster])

  const clusterColumns = [
    { title: 'Cluster', dataIndex: 'name', key: 'name', render: (v: string) => <Text style={{ color: '#e6edf3', fontFamily: 'monospace' }}>{v}</Text> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === 'kubernetes' ? 'blue' : 'purple'}>{v === 'kubernetes' ? 'K8s' : 'Standalone'}</Tag> },
    { title: 'Host', dataIndex: 'host', key: 'host', render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12, fontFamily: 'monospace' }}>{v}</Text> },
    {
      title: 'Status', key: 'status',
      render: (_: any, row: Cluster) => {
        const h = healthMap[row.id]
        if (!h) return <Spin size="small" />
        return statusBadge(h.reachable)
      },
    },
    {
      title: 'Version', key: 'version',
      render: (_: any, row: Cluster) => {
        const h = healthMap[row.id]
        return h?.server_info ? <Text style={{ color: '#8b949e', fontSize: 12 }}>{h.server_info.version}</Text> : <Text style={{ color: '#30363d' }}>—</Text>
      },
    },
  ]

  return (
    <div>
      <Title level={4} style={{ color: '#e6edf3', marginBottom: 20 }}>
        Cluster Overview
      </Title>

      {/* Stats cards */}
      {loadingStats ? <Spin /> : stats ? (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card style={{ background: '#161b22', border: '1px solid #30363d' }}>
              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Total Queries (24h)</Text>}
                value={stats.total_queries} valueStyle={{ color: '#e6edf3' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card style={{ background: '#161b22', border: '1px solid #da3633' }}>
              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Slow Queries</Text>}
                value={stats.slow_queries} prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#f85149' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card style={{ background: '#161b22', border: '1px solid #9e6a03' }}>
              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Full Scans</Text>}
                value={stats.full_scans} prefix={<WarningOutlined />}
                valueStyle={{ color: '#e3b341' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card style={{ background: '#161b22', border: '1px solid #6e40c9' }}>
              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Memory Hogs</Text>}
                value={stats.memory_hogs} prefix={<RocketOutlined />}
                valueStyle={{ color: '#a371f7' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card style={{ background: '#161b22', border: '1px solid #30363d' }}>
              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Avg Duration (s)</Text>}
                value={stats.avg_duration_sec} precision={2}
                valueStyle={{ color: '#58a6ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card style={{ background: '#161b22', border: '1px solid #30363d' }}>
              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 12 }}>Max Duration (s)</Text>}
                value={stats.max_duration_sec} precision={2}
                valueStyle={{ color: '#f0883e' }} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Alert
          type="warning"
          message="Select a reachable cluster to see stats"
          style={{ marginBottom: 24, background: '#161b22', border: '1px solid #9e6a03' }}
        />
      )}

      {/* Cluster inventory */}
      <Card
        title={<Text style={{ color: '#e6edf3' }}>Cluster Inventory</Text>}
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={clusters}
          columns={clusterColumns}
          rowKey="id"
          loading={loadingHealth}
          pagination={false}
          size="small"
          style={{ background: '#161b22' }}
        />
      </Card>
    </div>
  )
}

export default Dashboard
