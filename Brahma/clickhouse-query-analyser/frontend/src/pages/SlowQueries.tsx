import React, { useState, useCallback } from 'react'
import { Table, Button, Space, InputNumber, Select, Typography, Tag, Tooltip, Alert, Card } from 'antd'
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { queriesApi, SlowQuery } from '../api/client'
import { useAppStore } from '../store'
import dayjs from 'dayjs'

const { Text } = Typography

const truncate = (s: string, n = 120) => s && s.length > n ? s.slice(0, n) + '…' : s

const SlowQueries: React.FC = () => {
  const { selectedCluster } = useAppStore()
  const [data, setData] = useState<SlowQuery[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [durationMs, setDurationMs] = useState(5000)
  const [hours, setHours] = useState(24)
  const [limit, setLimit] = useState(50)

  const fetch = useCallback(() => {
    if (!selectedCluster) return
    setLoading(true)
    setError('')
    queriesApi.slowQueries(selectedCluster, { duration_ms: durationMs, hours, limit })
      .then(r => setData(r.data.queries))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false))
  }, [selectedCluster, durationMs, hours, limit])

  const columns = [
    {
      title: 'Duration (s)', dataIndex: 'duration_sec', key: 'dur', width: 110,
      sorter: (a: SlowQuery, b: SlowQuery) => b.duration_sec - a.duration_sec,
      render: (v: number) => (
        <Tag color={v > 30 ? 'red' : v > 10 ? 'orange' : 'gold'} style={{ fontFamily: 'monospace' }}>
          {v.toFixed(2)}s
        </Tag>
      ),
    },
    {
      title: 'Query', dataIndex: 'query', key: 'query',
      render: (v: string) => (
        <Tooltip title={<pre style={{ maxWidth: 600, whiteSpace: 'pre-wrap', fontSize: 12 }}>{v}</pre>}>
          <Text style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 12 }}>{truncate(v)}</Text>
        </Tooltip>
      ),
    },
    { title: 'User', dataIndex: 'user', key: 'user', width: 100, render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{v}</Text> },
    { title: 'Read Rows', dataIndex: 'read_rows', key: 'read_rows', width: 120, sorter: (a: SlowQuery, b: SlowQuery) => Number(b.read_rows) - Number(a.read_rows), render: (v: number) => <Text style={{ color: '#58a6ff', fontSize: 12 }}>{Number(v).toLocaleString()}</Text> },
    { title: 'Read Size', dataIndex: 'read_size', key: 'read_size', width: 100, render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{v}</Text> },
    { title: 'Memory', dataIndex: 'memory', key: 'memory', width: 100, render: (v: string) => <Text style={{ color: '#a371f7', fontSize: 12 }}>{v}</Text> },
    { title: 'Time', dataIndex: 'event_time', key: 'event_time', width: 140, render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 11 }}>{dayjs(v).format('MM-DD HH:mm:ss')}</Text> },
    {
      title: 'Exception', dataIndex: 'exception', key: 'exc', width: 120,
      render: (v: string) => v ? <Tag color="red" style={{ fontSize: 10 }}>Error</Tag> : <Tag color="green" style={{ fontSize: 10 }}>OK</Tag>,
    },
  ]

  return (
    <div>
      <Card
        style={{ background: '#161b22', border: '1px solid #30363d', marginBottom: 16 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space wrap>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Min duration:</Text>
          <InputNumber min={1000} step={1000} value={durationMs} onChange={v => setDurationMs(v ?? 5000)}
            addonAfter="ms" style={{ width: 140 }} />
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Lookback:</Text>
          <Select value={hours} onChange={setHours} style={{ width: 110 }}
            options={[{ value: 1, label: '1 hour' }, { value: 6, label: '6 hours' }, { value: 24, label: '24 hours' }, { value: 48, label: '48 hours' }, { value: 168, label: '7 days' }]} />
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Limit:</Text>
          <InputNumber min={1} max={500} value={limit} onChange={v => setLimit(v ?? 50)} style={{ width: 80 }} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetch} loading={loading}
            style={{ background: '#238636', borderColor: '#238636' }}>
            Run
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16, background: '#161b22', border: '1px solid #da3633' }} />}
      {!selectedCluster && <Alert type="warning" message="Select a cluster from the sidebar" style={{ marginBottom: 16 }} />}

      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#f85149' }} />
            <Text style={{ color: '#e6edf3' }}>Slow Queries — {data.length} results</Text>
          </Space>
        }
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="query_id"
          loading={loading}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          style={{ background: '#161b22' }}
          locale={{ emptyText: <Text style={{ color: '#8b949e' }}>Click Run to fetch slow queries</Text> }}
        />
      </Card>
    </div>
  )
}

export default SlowQueries
