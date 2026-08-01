import { useEffect, useState } from 'react'
import { Typography, Button, Table, Tag, Space, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { Cluster } from '@/types'
import { clusterApi } from '@/services/api'
import ClusterForm from '@/components/ClusterForm'

const { Title } = Typography

export default function Clusters() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    clusterApi.list().then((res) => setClusters(res.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const testConnection = async (id: string) => {
    setTestingId(id)
    try {
      const res = await clusterApi.test(id)
      if (res.data.ok) {
        message.success('Connection successful')
      } else {
        message.error(res.data.error ?? 'Connection failed')
      }
    } catch (err: any) {
      message.error(err.response?.data?.error ?? 'Connection failed')
    } finally {
      setTestingId(null)
    }
  }

  const removeCluster = async (id: string) => {
    await clusterApi.remove(id)
    load()
  }

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Clusters</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
          Add Cluster
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={clusters}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Type', dataIndex: 'type', render: (v) => <Tag color="blue">{v}</Tag> },
          { title: 'Host', dataIndex: 'host' },
          { title: 'Port', dataIndex: 'port' },
          {
            title: 'Actions',
            render: (_, c) => (
              <Space>
                <Button
                  icon={<ThunderboltOutlined />}
                  size="small"
                  loading={testingId === c.id}
                  onClick={() => testConnection(c.id)}
                >
                  Test
                </Button>
                <Popconfirm title="Delete this cluster? Key results using it will start failing." onConfirm={() => removeCluster(c.id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <ClusterForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={load} />
    </div>
  )
}
