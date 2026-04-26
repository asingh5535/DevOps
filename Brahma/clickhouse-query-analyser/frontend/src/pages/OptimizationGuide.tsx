import React, { useEffect, useState } from 'react'
import { Card, Tag, Typography, Collapse, Space, Checkbox, Divider, Spin, Row, Col } from 'antd'
import { WarningOutlined, CheckCircleOutlined, BulbOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { reportsApi, OptimizationPattern } from '../api/client'

const { Text, Title } = Typography

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
}

const SqlBlock: React.FC<{ code: string; label?: string }> = ({ code, label }) => (
  <div style={{ marginBottom: 8 }}>
    {label && <Text style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</Text>}
    <div style={{ border: '1px solid #30363d', borderRadius: 6, overflow: 'hidden' }}>
      <Editor
        height={`${Math.min(Math.max(code.split('\n').length * 20 + 20, 60), 300)}px`}
        language="sql"
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true, minimap: { enabled: false }, fontSize: 12,
          lineNumbers: 'off', scrollBeyondLastLine: false, wordWrap: 'on',
          renderLineHighlight: 'none', folding: false,
        }}
      />
    </div>
  </div>
)

const OptimizationGuide: React.FC = () => {
  const [patterns, setPatterns] = useState<OptimizationPattern[]>([])
  const [checklist, setChecklist] = useState<{ id: number; item: string }[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([reportsApi.patterns(), reportsApi.checklist()]).then(([p, c]) => {
      setPatterns(p.data.patterns)
      setChecklist(c.data.checklist)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spin style={{ marginTop: 40 }} />

  const skipIndexSQL = `-- Bloom filter for string columns
ALTER TABLE events
    ADD INDEX idx_country country TYPE bloom_filter(0.01) GRANULARITY 4;

-- MinMax for range queries
ALTER TABLE metrics
    ADD INDEX idx_value value TYPE minmax GRANULARITY 2;

-- Set index for IN queries
ALTER TABLE sessions
    ADD INDEX idx_platform platform TYPE set(100) GRANULARITY 4;

-- Materialize the index
ALTER TABLE events MATERIALIZE INDEX idx_country;`

  return (
    <div>
      <Row gutter={24}>
        <Col span={17}>
          <Title level={5} style={{ color: '#e6edf3', marginBottom: 16 }}>
            <BulbOutlined style={{ color: '#e3b341', marginRight: 8 }} />
            Bottleneck Patterns &amp; Fixes
          </Title>

          <Collapse
            style={{ background: '#161b22', border: '1px solid #30363d' }}
            items={patterns.map((p, i) => ({
              key: p.id,
              label: (
                <Space>
                  <Tag color={severityColor[p.severity]} style={{ fontSize: 11 }}>{p.severity.toUpperCase()}</Tag>
                  <Text style={{ color: '#e6edf3', fontSize: 13 }}>{i + 1}. {p.title}</Text>
                </Space>
              ),
              children: (
                <div>
                  <div style={{ background: '#0d1117', border: '1px solid #9e6a03', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                    <WarningOutlined style={{ color: '#e3b341', marginRight: 8 }} />
                    <Text style={{ color: '#e3b341', fontSize: 12 }}><strong>Why it's slow:</strong> {p.why}</Text>
                  </div>
                  <SqlBlock code={p.bad} label="❌  Slow (before)" />
                  <SqlBlock code={p.good} label="✅  Fast (after)" />
                </div>
              ),
            }))}
          />

          <Divider style={{ borderColor: '#30363d' }} />

          <Title level={5} style={{ color: '#e6edf3', marginBottom: 12 }}>
            Recommended Skip Indexes
          </Title>
          <SqlBlock code={skipIndexSQL} />
        </Col>

        <Col span={7}>
          <Card
            title={<Space><CheckCircleOutlined style={{ color: '#3fb950' }} /><Text style={{ color: '#e6edf3' }}>Optimization Checklist</Text></Space>}
            style={{ background: '#161b22', border: '1px solid #30363d', position: 'sticky', top: 0 }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <Text style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 12 }}>
              {checked.size}/{checklist.length} completed
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {checklist.map(item => (
                <Checkbox
                  key={item.id}
                  checked={checked.has(item.id)}
                  onChange={e => {
                    const next = new Set(checked)
                    e.target.checked ? next.add(item.id) : next.delete(item.id)
                    setChecked(next)
                  }}
                >
                  <Text style={{ color: checked.has(item.id) ? '#3fb950' : '#e6edf3', fontSize: 12 }}>
                    {item.item}
                  </Text>
                </Checkbox>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default OptimizationGuide
