import React, { useState, useCallback } from 'react'
import { Table, Button, Space, Select, Typography, Tag, Tooltip, Alert, Card } from 'antd'
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { queriesApi, FullScan } from '../api/client'
import { useAppStore } from '../store'

const { Text } = Typography
const truncate = (s: string, n = 120) => s && s.length > n ? s.slice(0, n) + '…' : s

const FullScans: React.FC = () => {
  const { selectedCluster } = useAppStore()
  const [data, setData] = useState<FullScan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hours, setHours] = useState(24)

  const fetch = useCallback(() => {
    if (!selectedCluster) return
    setLoading(true)
    setError('')
    queriesApi.fullScans(selectedCluster, { hours, limit: 20 })
      .then(r => setData(r.data.queries))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false))
  }, [selectedCluster, hours])

  const columns = [
    {
      title: 'Read Rows', dataIndex: 'read_rows', key: 'read_rows', width: 130,
      sorter: (a: FullScan, b: FullScan) => Number(b.read_rows) - Number(a.read_rows),
      render: (v: number) => <Tag color="red" style={{ fontFamily: 'monospace' }}>{Number(v).toLocaleString()}</Tag>,
    },
    {
      title: 'Bytes Read', dataIndex: 'bytes_read', key: 'bytes_read', width: 110,
      render: (v: string) => <Text style={{ color: '#f0883e', fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Duration (s)', dataIndex: 'duration_sec', key: 'dur', width: 110,
      sorter: (a: FullScan, b: FullScan) => b.duration_sec - a.duration_sec,
      render: (v: number) => <Tag color="orange" style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}s</Tag>,
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
            options={[{ value: 1, label: '1 hour' }, { value: 6, label: '6 hours' }, { value: 24, label: '24 hours' }, { value: 48, label: '48 hours' }]} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetch} loading={loading}
            style={{ background: '#9e6a03', borderColor: '#9e6a03' }}>
            Run
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <Card
        title={<Space><WarningOutlined style={{ color: '#e3b341' }} /><Text style={{ color: '#e6edf3' }}>Full Table Scans (&gt;100M rows) — {data.length} results</Text></Space>}
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table dataSource={data} columns={columns} rowKey={(r, i) => `${i}`} loading={loading}
          size="small" pagination={{ pageSize: 20 }} style={{ background: '#161b22' }}
          locale={{ emptyText: <Text style={{ color: '#8b949e' }}>Click Run to detect full scans</Text> }} />
      </Card>
    </div>
  )
}

export default FullScans
