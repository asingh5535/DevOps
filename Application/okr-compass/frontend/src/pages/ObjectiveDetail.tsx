import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Button, Space, Tag, Empty, Breadcrumb } from 'antd'
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { Objective } from '@/types'
import { objectiveApi } from '@/services/api'
import ProgressCard from '@/components/ProgressCard'
import KeyResultBuilder from '@/components/KeyResultBuilder'

const { Title, Paragraph } = Typography

export default function ObjectiveDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [objective, setObjective] = useState<Objective | null>(null)
  const [loading, setLoading] = useState(true)
  const [builderOpen, setBuilderOpen] = useState(false)

  const load = () => {
    if (!id) return
    setLoading(true)
    objectiveApi.get(id).then((res) => setObjective(res.data)).finally(() => setLoading(false))
  }

  useEffect(load, [id])

  if (!loading && !objective) {
    return <Empty description="Objective not found" />
  }

  return (
    <div>
      <Breadcrumb
        items={[{ title: 'Objectives', onClick: () => navigate('/objectives') }, { title: objective?.title ?? '' }]}
        style={{ marginBottom: 8, cursor: 'pointer' }}
      />

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} align="start">
        <div>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/objectives')} style={{ paddingLeft: 0 }}>
            Back
          </Button>
          <Title level={3} style={{ margin: 0 }}>{objective?.title}</Title>
          <Paragraph type="secondary">{objective?.description}</Paragraph>
          <Space>
            <Tag color="purple">{objective?.team || 'No team'}</Tag>
            <Tag color="geekblue">{objective?.quarter || 'No quarter'}</Tag>
            {objective?.owner && <Tag>{objective.owner}</Tag>}
          </Space>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setBuilderOpen(true)}>
          Add Key Result
        </Button>
      </Space>

      {(!objective?.keyResults || objective.keyResults.length === 0) ? (
        <Empty description="No key results yet — add one bound to a metric from a registered cluster" />
      ) : (
        objective.keyResults.map((kr) => (
          <ProgressCard key={kr.id} keyResult={kr} onChanged={load} />
        ))
      )}

      {id && (
        <KeyResultBuilder
          open={builderOpen}
          objectiveId={id}
          onClose={() => setBuilderOpen(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
