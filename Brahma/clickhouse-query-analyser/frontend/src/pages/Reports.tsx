import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Typography, Spin, Space, Button, Alert, Collapse, Statistic, Row, Col } from 'antd'
import { ScheduleOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { reportsApi } from '../api/client'

const { Text, Title } = Typography

const Reports: React.FC = () => {
  const [schedule, setSchedule] = useState<any[]>([])
  const [dailyReport, setDailyReport] = useState<any>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    reportsApi.schedule().then(r => setSchedule(r.data.schedule)).finally(() => setLoadingSchedule(false))
  }, [])

  const runDailyReport = () => {
    setLoadingReport(true)
    setError('')
    reportsApi.daily()
      .then(r => setDailyReport(r.data))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoadingReport(false))
  }

  const scheduleColumns = [
    { title: 'Report', dataIndex: 'report', key: 'report', render: (v: string) => <Text style={{ color: '#e6edf3', fontSize: 13 }}>{v}</Text> },
    {
      title: 'Schedule', dataIndex: 'schedule', key: 'schedule',
      render: (v: string, r: any) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#58a6ff' }} />
          <Text style={{ color: '#58a6ff', fontSize: 12 }}>{v}</Text>
          {r.cron !== 'realtime' && <Tag style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.cron}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Clusters', dataIndex: 'clusters', key: 'clusters',
      render: (v: string) => <Tag color={v === 'All' ? 'blue' : v === 'K8s' ? 'cyan' : 'purple'}>{v}</Tag>,
    },
  ]

  return (
    <div>
      <Card
        title={<Space><ScheduleOutlined style={{ color: '#58a6ff' }} /><Text style={{ color: '#e6edf3' }}>Automated Report Schedule (IST)</Text></Space>}
        style={{ background: '#161b22', border: '1px solid #30363d', marginBottom: 20 }}
        bodyStyle={{ padding: 0 }}
      >
        {loadingSchedule ? <Spin style={{ margin: 20 }} /> : (
          <Table dataSource={schedule} columns={scheduleColumns} rowKey="report"
            pagination={false} size="small" style={{ background: '#161b22' }} />
        )}
      </Card>

      <Card
        title={<Text style={{ color: '#e6edf3' }}>Daily Slow Query Digest</Text>}
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        extra={
          <Button icon={<ReloadOutlined />} onClick={runDailyReport} loading={loadingReport}
            style={{ background: '#238636', borderColor: '#238636', color: '#fff' }}>
            Generate Now
          </Button>
        }
      >
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

        {!dailyReport && !loadingReport && (
          <Text style={{ color: '#8b949e' }}>Click "Generate Now" to run the daily digest across all clusters.</Text>
        )}

        {loadingReport && <Spin style={{ display: 'block', margin: '20px auto' }} />}

        {dailyReport && (
          <div>
            <Text style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 16 }}>
              Generated at {dailyReport.generated_at} — {dailyReport.period_hours}h lookback — {dailyReport.total} clusters
            </Text>

            <Collapse
              style={{ background: '#0d1117', border: '1px solid #30363d' }}
              items={(dailyReport.clusters ?? []).map((cr: any) => ({
                key: cr.cluster_id,
                label: (
                  <Space>
                    <Tag color={cr.status === 'active' ? 'green' : 'red'}>{cr.status}</Tag>
                    <Text style={{ color: '#e6edf3', fontFamily: 'monospace' }}>{cr.cluster_name}</Text>
                    {cr.stats && (
                      <Text style={{ color: '#8b949e', fontSize: 12 }}>
                        {cr.stats.slow_queries} slow / {cr.stats.total_queries} total
                      </Text>
                    )}
                  </Space>
                ),
                children: cr.error ? (
                  <Alert type="error" message={cr.error} />
                ) : (
                  <div>
                    {cr.stats && (
                      <Row gutter={12} style={{ marginBottom: 16 }}>
                        {[
                          { title: 'Total Queries', value: cr.stats.total_queries },
                          { title: 'Slow (>5s)', value: cr.stats.slow_queries, color: '#f85149' },
                          { title: 'Full Scans', value: cr.stats.full_scans, color: '#e3b341' },
                          { title: 'Memory Hogs', value: cr.stats.memory_hogs, color: '#a371f7' },
                          { title: 'Max Duration', value: `${cr.stats.max_duration_sec}s`, color: '#f0883e' },
                        ].map(s => (
                          <Col span={5} key={s.title}>
                            <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                              <Statistic title={<Text style={{ color: '#8b949e', fontSize: 11 }}>{s.title}</Text>}
                                value={s.value} valueStyle={{ color: s.color ?? '#e6edf3', fontSize: 16 }} />
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                    {cr.slow_queries?.length > 0 && (
                      <Table
                        size="small"
                        dataSource={cr.slow_queries.slice(0, 5)}
                        rowKey="query_id"
                        pagination={false}
                        columns={[
                          { title: 'Duration', dataIndex: 'duration_sec', key: 'd', width: 90, render: (v: number) => <Tag color="orange">{v?.toFixed(2)}s</Tag> },
                          { title: 'User', dataIndex: 'user', key: 'u', width: 80, render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 11 }}>{v}</Text> },
                          { title: 'Query', dataIndex: 'query', key: 'q', render: (v: string) => <Text style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 11 }}>{v?.slice(0, 100)}…</Text> },
                        ]}
                        style={{ background: '#0d1117' }}
                      />
                    )}
                  </div>
                ),
              }))}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export default Reports
