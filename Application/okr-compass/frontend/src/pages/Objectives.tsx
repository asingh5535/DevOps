import { useEffect, useState } from 'react'
import { Typography, Button, Card, List, Tag, Modal, Form, Input, Progress, message, Popconfirm, Space } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { Objective } from '@/types'
import { objectiveApi } from '@/services/api'

const { Title, Text } = Typography

function averageProgress(o: Objective): number {
  if (!o.keyResults || o.keyResults.length === 0) return 0
  return o.keyResults.reduce((sum, kr) => sum + kr.progress, 0) / o.keyResults.length
}

export default function Objectives() {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    objectiveApi.list().then((res) => setObjectives(res.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const createObjective = async () => {
    try {
      const values = await form.validateFields()
      await objectiveApi.create(values)
      message.success('Objective created')
      form.resetFields()
      setModalOpen(false)
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.response?.data?.error ?? 'Failed to create objective')
    }
  }

  const removeObjective = async (id: string) => {
    await objectiveApi.remove(id)
    load()
  }

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Objectives</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Objective
        </Button>
      </Space>

      <List
        loading={loading}
        grid={{ gutter: 16, column: 2 }}
        dataSource={objectives}
        renderItem={(o) => (
          <List.Item>
            <Card
              title={<Link to={`/objectives/${o.id}`}>{o.title}</Link>}
              extra={
                <Popconfirm title="Delete this objective and its key results?" onConfirm={() => removeObjective(o.id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              }
            >
              <Text type="secondary">{o.description || 'No description'}</Text>
              <div style={{ margin: '12px 0' }}>
                <Tag color="purple">{o.team || 'No team'}</Tag>
                <Tag color="geekblue">{o.quarter || 'No quarter'}</Tag>
                {o.owner && <Tag>{o.owner}</Tag>}
              </div>
              <Progress percent={Math.round(averageProgress(o))} />
              <Text type="secondary" style={{ fontSize: 12 }}>{o.keyResults?.length ?? 0} key results</Text>
            </Card>
          </List.Item>
        )}
      />

      <Modal title="New Objective" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={createObjective} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Improve platform reliability" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="owner" label="Owner">
            <Input placeholder="e.g. jane@company.com" />
          </Form.Item>
          <Form.Item name="team" label="Team">
            <Input placeholder="e.g. Platform" />
          </Form.Item>
          <Form.Item name="quarter" label="Quarter">
            <Input placeholder="e.g. 2026-Q3" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
