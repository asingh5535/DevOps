import React, { useState } from 'react'
import { Card, Table, Tag, Badge, Button, Modal, Form, Input, InputNumber, Select, Typography, Space, Popconfirm, Alert, Spin } from 'antd'
import { PlusOutlined, DeleteOutlined, SyncOutlined, ClusterOutlined } from '@ant-design/icons'
import { clustersApi, Cluster } from '../api/client'
import { useAppStore } from '../store'

const { Text } = Typography

const Clusters: React.FC = () => {
  const { clusters, setClusters } = useAppStore()
  const [healthMap, setHealthMap] = useState<Record<string, Cluster>>({})
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const checkHealth = (id: string) => {
    setChecking(p => ({ ...p, [id]: true }))
    clustersApi.health(id).then(r => {
      setHealthMap(p => ({ ...p, [id]: r.data }))
    }).catch(() => {
      setHealthMap(p => ({ ...p, [id]: { id, reachable: false } as any }))
    }).finally(() => {
      setChecking(p => ({ ...p, [id]: false }))
    })
  }

  const checkAll = () => clusters.forEach(c => checkHealth(c.id))

  const handleAdd = async () => {
    const vals = await form.validateFields()
    setAdding(true)
    clustersApi.add(vals).then(() => {
      clustersApi.list().then(r => setClusters(r.data.clusters))
      setAddOpen(false)
      form.resetFields()
    }).catch(e => setError(e.response?.data?.error ?? e.message)).finally(() => setAdding(false))
  }

  const handleDelete = (id: string) => {
    clustersApi.remove(id).then(() => {
      clustersApi.list().then(r => setClusters(r.data.clusters))
    })
  }

  const columns = [
    {
      title: 'ID', dataIndex: 'id', key: 'id', width: 140,
      render: (v: string) => <Text style={{ color: '#58a6ff', fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 110,
      render: (v: string) => <Tag color={v === 'kubernetes' ? 'blue' : 'purple'}>{v === 'kubernetes' ? 'Kubernetes' : 'Standalone'}</Tag>,
    },
    {
      title: 'Host', dataIndex: 'host', key: 'host',
      render: (v: string, r: Cluster) => (
        <Text style={{ color: '#8b949e', fontSize: 12, fontFamily: 'monospace' }}>{v}:{r.port}</Text>
      ),
    },
    {
      title: 'Description', dataIndex: 'description', key: 'desc',
      render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_: any, row: Cluster) => {
        const h = healthMap[row.id]
        if (checking[row.id]) return <Spin size="small" />
        if (!h) return <Text style={{ color: '#30363d', fontSize: 12 }}>Not checked</Text>
        if (h.reachable) return <Badge status="success" text={<Text style={{ color: '#3fb950', fontSize: 12 }}>{h.server_info?.version ?? 'Active'}</Text>} />
        return <Badge status="error" text={<Text style={{ color: '#f85149', fontSize: 12 }}>Unreachable</Text>} />
      },
    },
    {
      title: 'Actions', key: 'actions', width: 130,
      render: (_: any, row: Cluster) => (
        <Space>
          <Button size="small" icon={<SyncOutlined />} onClick={() => checkHealth(row.id)} loading={checking[row.id]}>Check</Button>
          <Popconfirm title="Remove this cluster?" onConfirm={() => handleDelete(row.id)} okText="Remove" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={<Space><ClusterOutlined style={{ color: '#58a6ff' }} /><Text style={{ color: '#e6edf3' }}>Registered Clusters ({clusters.length})</Text></Space>}
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        bodyStyle={{ padding: 0 }}
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={checkAll} style={{ fontSize: 12 }}>Check All</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}
              style={{ background: '#238636', borderColor: '#238636' }}>
              Add Cluster
            </Button>
          </Space>
        }
      >
        <Table dataSource={clusters} columns={columns} rowKey="id" size="small" pagination={false} style={{ background: '#161b22' }} />
      </Card>

      {/* Connecting instructions */}
      <Card title={<Text style={{ color: '#8b949e', fontSize: 13 }}>Connection Reference</Text>}
        style={{ background: '#161b22', border: '1px solid #30363d', marginTop: 20 }} size="small">
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>K8s clusters — port-forward first:</Text>
          <pre style={{ background: '#0d1117', padding: '8px 12px', borderRadius: 4, fontSize: 12, color: '#e6edf3', border: '1px solid #30363d' }}>
            {`kubectl port-forward svc/clickhouse 9000:9000 -n k8scenter`}
          </pre>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Standalone — direct connection:</Text>
          <pre style={{ background: '#0d1117', padding: '8px 12px', borderRadius: 4, fontSize: 12, color: '#e6edf3', border: '1px solid #30363d' }}>
            {`clickhouse-client --host standalone-01.torres.internal --port 9000 --query "SELECT hostname(), version()"`}
          </pre>
        </Space>
      </Card>

      <Modal
        title={<Text style={{ color: '#e6edf3' }}>Add ClickHouse Cluster</Text>}
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => { setAddOpen(false); form.resetFields(); setError('') }}
        confirmLoading={adding}
        okText="Add"
        okButtonProps={{ style: { background: '#238636', borderColor: '#238636' } }}
        styles={{ content: { background: '#161b22' }, header: { background: '#161b22' }, footer: { background: '#161b22' } }}
      >
        {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
        <Form form={form} layout="vertical" initialValues={{ port: 9000, user: 'default', database: 'default', type: 'standalone' }}>
          <Form.Item name="id" label={<Text style={{ color: '#8b949e' }}>Cluster ID</Text>} rules={[{ required: true }]}>
            <Input placeholder="e.g. prod-01" style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
          <Form.Item name="name" label={<Text style={{ color: '#8b949e' }}>Name</Text>} rules={[{ required: true }]}>
            <Input placeholder="Display name" style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
          <Form.Item name="type" label={<Text style={{ color: '#8b949e' }}>Type</Text>}>
            <Select options={[{ value: 'standalone', label: 'Standalone' }, { value: 'kubernetes', label: 'Kubernetes' }]} />
          </Form.Item>
          <Form.Item name="host" label={<Text style={{ color: '#8b949e' }}>Host</Text>} rules={[{ required: true }]}>
            <Input placeholder="localhost or hostname" style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
          <Form.Item name="port" label={<Text style={{ color: '#8b949e' }}>Port</Text>}>
            <InputNumber style={{ width: '100%', background: '#0d1117', borderColor: '#30363d' }} />
          </Form.Item>
          <Form.Item name="user" label={<Text style={{ color: '#8b949e' }}>User</Text>}>
            <Input style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
          <Form.Item name="password" label={<Text style={{ color: '#8b949e' }}>Password</Text>}>
            <Input.Password style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
          <Form.Item name="database" label={<Text style={{ color: '#8b949e' }}>Database</Text>}>
            <Input style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
          <Form.Item name="description" label={<Text style={{ color: '#8b949e' }}>Description</Text>}>
            <Input style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Clusters
