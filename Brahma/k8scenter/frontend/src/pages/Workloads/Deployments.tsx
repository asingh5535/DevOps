import React, { useEffect, useState } from 'react'
import {
  Tag, Badge, Button, Space, InputNumber, Popover, Tooltip, Typography, message,
} from 'antd'
import {
  ThunderboltOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { namespaceCol, ageCol } from '@/components/ResourceTable'
import YamlEditor from '@/components/YamlEditor'
import { workloadApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type { Deployment, KubeList } from '@/types'
import { getDeploymentStatus } from '@/utils'
import { Modal } from 'antd'
import { toYAML } from '@/utils'

const { Title } = Typography

const defaultDeploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-container
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "250m"
          limits:
            memory: "128Mi"
            cpu: "500m"
`

export default function Deployments() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createYaml, setCreateYaml] = useState(defaultDeploymentYaml)
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listDeployments(selectedNamespace || undefined)
      .then((res) => {
        const list = res.data as KubeList<Deployment>
        setData(list.items)
      })
      .catch(() => message.error('Failed to load deployments'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<Deployment>[] = [
    {
      title: 'Name',
      key: 'name',
      sorter: (a, b) => a.metadata.name.localeCompare(b.metadata.name),
      render: (_, r) => (
        <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span>
      ),
    },
    namespaceCol<Deployment>(),
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const s = getDeploymentStatus(r)
        return (
          <Badge
            status={s === 'healthy' ? 'success' : s === 'degraded' ? 'warning' : 'error'}
            text={
              <span style={{ color: s === 'healthy' ? '#52c41a' : s === 'degraded' ? '#faad14' : '#ff4d4f' }}>
                {s}
              </span>
            }
          />
        )
      },
    },
    {
      title: 'Replicas',
      key: 'replicas',
      width: 120,
      render: (_, r) => {
        const desired = r.spec?.replicas ?? 0
        const ready = r.status?.readyReplicas ?? 0
        return (
          <span>
            <span style={{ color: ready === desired ? '#52c41a' : '#faad14', fontWeight: 600 }}>{ready}</span>
            <span style={{ color: '#8b949e' }}> / {desired}</span>
          </span>
        )
      },
    },
    {
      title: 'Image',
      key: 'image',
      render: (_, r) => {
        const containers = (r as unknown as { spec?: { template?: { spec?: { containers?: Array<{ image?: string }> } } } }).spec?.template?.spec?.containers ?? []
        return (
          <Space direction="vertical" size={0}>
            {containers.slice(0, 2).map((c, i) => (
              <Tag key={i} style={{ fontSize: 11, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.image}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Scale',
      key: 'scale',
      width: 140,
      render: (_, r) => (
        <ScaleControl
          current={r.spec?.replicas ?? 0}
          onScale={(n) => workloadApi.scaleDeployment(r.metadata.namespace!, r.metadata.name, n).then(load)}
        />
      ),
    },
    {
      title: 'Restart',
      key: 'restart',
      width: 100,
      render: (_, r) => (
        <Tooltip title="Rolling restart">
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() =>
              workloadApi.restartDeployment(r.metadata.namespace!, r.metadata.name)
                .then(() => message.success('Restart triggered'))
                .catch(() => message.error('Restart failed'))
            }
          >
            Restart
          </Button>
        </Tooltip>
      ),
    },
    ageCol<Deployment>(),
  ]

  async function handleDelete(record: Deployment) {
    await workloadApi.deleteDeployment(record.metadata.namespace!, record.metadata.name)
    load()
  }

  async function handleCreate() {
    setCreating(true)
    try {
      await workloadApi.applyYAML(createYaml)
      message.success('Deployment created')
      setCreateOpen(false)
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      message.error(e?.response?.data?.error ?? 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Deployments</Title>
      </div>

      <ResourceTable<Deployment>
        data={data}
        columns={columns}
        loading={loading}
        onRefresh={load}
        onDelete={handleDelete}
        extraActions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Create
          </Button>
        }
      />

      <Modal
        title="Create Deployment"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setCreateOpen(false)}>Cancel</Button>,
          <Button key="create" type="primary" loading={creating} onClick={handleCreate}>
            Apply
          </Button>,
        ]}
        styles={{ body: { padding: 0 } }}
      >
        <YamlEditor value={createYaml} onChange={setCreateYaml} height={500} />
      </Modal>
    </div>
  )
}

function ScaleControl({ current, onScale }: { current: number; onScale: (n: number) => void }) {
  const [val, setVal] = useState(current)
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <Space>
          <InputNumber
            min={0}
            max={100}
            value={val}
            onChange={(v) => setVal(v ?? 0)}
            style={{ width: 80 }}
          />
          <Button
            type="primary"
            size="small"
            onClick={() => { onScale(val); setOpen(false) }}
          >
            Scale
          </Button>
        </Space>
      }
    >
      <Button size="small" style={{ width: 70 }}>
        {current} <ReloadOutlined style={{ fontSize: 10, marginLeft: 4 }} />
      </Button>
    </Popover>
  )
}
