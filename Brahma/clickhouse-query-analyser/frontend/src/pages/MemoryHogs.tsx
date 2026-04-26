import React, { useState, useCallback } from 'react'
import { Table, Button, Space, Select, Typography, Tag, Tooltip, Alert, Card } from 'antd'
import { ReloadOutlined, RocketOutlined } from '@ant-design/icons'
import { queriesApi, MemoryHog } from '../api/client'
import { useAppStore } from '../store'

const { Text } = Typography
const truncate = (s: string, n = 120) => s && s.length > n ? s.slice(0, n) + '…' : s

const MemoryHogs: React.FC = () => {
  const { selectedCluster } = useAppStore()
  const [data, setData] = useState<MemoryHog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hours, setHours] = useState(24)

  const fetch = useCallback(() => {
    if (!selectedCluster) return
    setLoading(true)
    setError('')
    queriesApi.memoryHogs(selectedCluster, { hours, limit: 20 })
      .then(r => setData(r.data.queries))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false))
  }, [selectedCluster, hours])

  const columns = [
    {
      title: 'Memory', dataIndex: 'memory', key: 'memory', width: 110,
      render: (v: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: 'Duration (s)', dataIndex: 'duration_sec', key: 'dur', width: 110,
      sorter: (a: MemoryHog, b: MemoryHog) => b.duration_sec - a.duration_sec,
      render: (v: number) => <Tag color="orange">{v.toFixed(2)}s</Tag>,
    },
    {
      title: 'Query ID', dataIndex: 'query_id', key: 'qid', width: 140,
      render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 11, fontFamily: 'monospace' }}>{v?.slice(0, 12)}…</Text>,
    },
    {
      title: 'Query', dataIndex: 'query', key: 'query',
      render: (v: string) => (
        <Tooltip title={<pre style={{ maxWidth: 600, whiteSpace: 'pre-wrap', fontSize: 12 }}>{v}</pre>}>
          <Text style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 12 }}>{truncate(v)}</Text>
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ background: '#161b22', border: '1px solid #30363d', marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Lookback:</Text>
          <Select value={hours} onChange={setHours} style={{ width: 110 }}
            options={[{ value: 1, label: '1 hour' }, { value: 6, label: '6 hours' }, { value: 24, label: '24 hours' }]} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetch} loading={loading}
            style={{ background: '#6e40c9', borderColor: '#6e40c9' }}>
            Run
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <Card
        title={<Space><RocketOutlined style={{ color: '#a371f7' }} /><Text style={{ color: '#e6edf3' }}>Memory Hogs (&gt;1 GB) — {data.length} results</Text></Space>}
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table dataSource={data} columns={columns} rowKey="query_id" loading={loading}
          size="small" pagination={{ pageSize: 20 }} style={{ background: '#161b22' }}
          locale={{ emptyText: <Text style={{ color: '#8b949e' }}>Click Run to find memory hogs</Text> }} />
      </Card>
    </div>
  )
}

export default MemoryHogs
