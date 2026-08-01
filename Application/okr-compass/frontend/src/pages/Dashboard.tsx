import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Progress, Typography, Empty } from 'antd'
import { Link } from 'react-router-dom'
import type { DashboardSummary } from '@/types'
import { dashboardApi } from '@/services/api'

const { Title } = Typography

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.summary().then((res) => setSummary(res.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Title level={3}>Dashboard</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Objectives" value={summary?.objectiveCount ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Key Results" value={summary?.keyResultCount ?? 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="Overall Progress"
              value={summary?.overallProgress ?? 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="Progress by Team / Quarter" loading={loading}>
            <Table
              rowKey={(g) => `${g.team}-${g.quarter}`}
              dataSource={summary?.teamQuarterGroups ?? []}
              pagination={false}
              locale={{ emptyText: <Empty description="No objectives yet" /> }}
              columns={[
                { title: 'Team', dataIndex: 'team', render: (v) => v || '—' },
                { title: 'Quarter', dataIndex: 'quarter', render: (v) => v || '—' },
                { title: 'Objectives', dataIndex: 'objectiveCount' },
                { title: 'Key Results', dataIndex: 'keyResultCount' },
                {
                  title: 'Avg Progress',
                  dataIndex: 'averageProgress',
                  render: (v: number) => <Progress percent={Math.round(v)} size="small" />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="At-Risk Key Results (< 40% progress)" loading={loading}>
            <Table
              rowKey="id"
              dataSource={summary?.atRiskKeyResults ?? []}
              pagination={false}
              locale={{ emptyText: <Empty description="Nothing at risk" /> }}
              columns={[
                {
                  title: 'Key Result',
                  dataIndex: 'title',
                  render: (v, kr) => <Link to={`/objectives/${kr.objectiveId}`}>{v}</Link>,
                },
                { title: 'Team', dataIndex: 'team', render: (v) => v || '—' },
                {
                  title: 'Progress',
                  dataIndex: 'progress',
                  render: (v: number) => <Tag color="red">{Math.round(v)}%</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
