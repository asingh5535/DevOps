import React, { useState } from 'react'
import { Button, Select, Typography, Alert, Card, Space, Tabs, Tag, Divider } from 'antd'
import { PlayCircleOutlined, CodeOutlined, CopyOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { queriesApi } from '../api/client'
import { useAppStore } from '../store'

const { Text } = Typography

const EXAMPLE_QUERIES = [
  { label: 'Slow aggregation', value: "SELECT user_id, count(*) FROM events WHERE country = 'IN' GROUP BY user_id" },
  { label: 'Full scan risk', value: "SELECT * FROM raw_logs WHERE level = 'ERROR' LIMIT 1000" },
  { label: 'Date range', value: "SELECT toDate(timestamp), sum(value) FROM metrics WHERE timestamp >= now() - INTERVAL 7 DAY GROUP BY 1" },
  { label: 'system.query_log daily digest', value: `SELECT query_id, user, query, query_duration_ms / 1000 AS duration_sec, read_rows, formatReadableSize(read_bytes) AS read_size FROM system.query_log WHERE type = 'QueryFinish' AND query_duration_ms > 5000 AND event_time >= today() ORDER BY query_duration_ms DESC LIMIT 20` },
]

const QueryExplain: React.FC = () => {
  const { selectedCluster } = useAppStore()
  const [query, setQuery] = useState("SELECT user_id, count(*) FROM events WHERE country = 'IN' GROUP BY user_id")
  const [mode, setMode] = useState<'plan' | 'indexes' | 'pipeline'>('plan')
  const [results, setResults] = useState<{ plan: string[]; indexes: string[]; pipeline: string[] }>({ plan: [], indexes: [], pipeline: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runExplain = async () => {
    if (!selectedCluster || !query.trim()) return
    setLoading(true)
    setError('')
    try {
      const [plan, indexes, pipeline] = await Promise.allSettled([
        queriesApi.explain(selectedCluster, query, 'plan'),
        queriesApi.explain(selectedCluster, query, 'indexes'),
        queriesApi.explain(selectedCluster, query, 'pipeline'),
      ])
      setResults({
        plan: plan.status === 'fulfilled' ? plan.value.data.lines : [],
        indexes: indexes.status === 'fulfilled' ? indexes.value.data.lines : [],
        pipeline: pipeline.status === 'fulfilled' ? pipeline.value.data.lines : [],
      })
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message)
    } finally {
      setLoading(false)
    }
  }

  const ExplainOutput: React.FC<{ lines: string[] }> = ({ lines }) => (
    <pre style={{
      background: '#0d1117', color: '#e6edf3', padding: 16, borderRadius: 6,
      fontSize: 12, lineHeight: 1.6, overflowX: 'auto', minHeight: 120,
      border: '1px solid #30363d', whiteSpace: 'pre-wrap',
    }}>
      {lines.length > 0 ? lines.join('\n') : <Text style={{ color: '#8b949e' }}>No output — run explain first</Text>}
    </pre>
  )

  return (
    <div>
      <Card style={{ background: '#161b22', border: '1px solid #30363d', marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Load example:</Text>
          <Select
            placeholder="Select example..."
            style={{ width: 220 }}
            options={EXAMPLE_QUERIES.map(q => ({ value: q.value, label: q.label }))}
            onChange={v => setQuery(v)}
            size="small"
          />
        </Space>

        <div style={{ border: '1px solid #30363d', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          <Editor
            height="180px"
            language="sql"
            value={query}
            onChange={v => setQuery(v ?? '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        </div>

        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={runExplain}
          loading={loading}
          disabled={!selectedCluster}
          style={{ background: '#238636', borderColor: '#238636' }}
        >
          Run EXPLAIN (all modes)
        </Button>

        {!selectedCluster && <Text style={{ color: '#e3b341', marginLeft: 12, fontSize: 12 }}>Select a cluster first</Text>}
      </Card>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <Card
        title={<Space><CodeOutlined style={{ color: '#58a6ff' }} /><Text style={{ color: '#e6edf3' }}>EXPLAIN Output</Text></Space>}
        style={{ background: '#161b22', border: '1px solid #30363d' }}
      >
        <Tabs
          defaultActiveKey="plan"
          items={[
            {
              key: 'plan', label: <Text style={{ color: '#e6edf3' }}>Query Plan</Text>,
              children: <ExplainOutput lines={results.plan} />,
            },
            {
              key: 'indexes', label: <Space><Text style={{ color: '#e6edf3' }}>Indexes</Text><Tag color="blue" style={{ fontSize: 10 }}>indexes=1</Tag></Space>,
              children: <ExplainOutput lines={results.indexes} />,
            },
            {
              key: 'pipeline', label: <Space><Text style={{ color: '#e6edf3' }}>Pipeline</Text><Tag color="purple" style={{ fontSize: 10 }}>PIPELINE</Tag></Space>,
              children: <ExplainOutput lines={results.pipeline} />,
            },
          ]}
        />
      </Card>

      {/* Quick reference */}
      <Card
        title={<Text style={{ color: '#8b949e', fontSize: 13 }}>Quick Reference — EXPLAIN modes</Text>}
        style={{ background: '#161b22', border: '1px solid #30363d', marginTop: 16 }}
        size="small"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {[
            { cmd: 'EXPLAIN', desc: 'Shows the logical query plan — table reads, aggregations, joins' },
            { cmd: 'EXPLAIN indexes = 1', desc: 'Shows which primary key ranges and skip indexes are used' },
            { cmd: 'EXPLAIN PIPELINE', desc: 'Shows the full execution pipeline — parallelism, processors' },
          ].map(item => (
            <div key={item.cmd}>
              <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.cmd}</Tag>
              <Text style={{ color: '#8b949e', fontSize: 12, marginLeft: 8 }}>{item.desc}</Text>
            </div>
          ))}
        </Space>
      </Card>
    </div>
  )
}

export default QueryExplain
