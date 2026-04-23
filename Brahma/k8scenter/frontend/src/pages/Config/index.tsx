import React, { useEffect, useState } from 'react'
import { Tag, Typography, Button, Modal, message, Tooltip, Space } from 'antd'
import { EyeOutlined, EyeInvisibleOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { namespaceCol, ageCol } from '@/components/ResourceTable'
import YamlEditor from '@/components/YamlEditor'
import { configApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type {
  ConfigMap, Secret, PersistentVolume, PersistentVolumeClaim, StorageClass, KubeList,
} from '@/types'

const { Title } = Typography

// ── ConfigMaps ────────────────────────────────────────────────────────────────

export function ConfigMaps() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<ConfigMap[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createYaml, setCreateYaml] = useState(defaultConfigMapYaml)

  const load = () => {
    setLoading(true)
    configApi.listConfigMaps(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<ConfigMap>).items))
      .catch(() => message.error('Failed to load ConfigMaps'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<ConfigMap>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<ConfigMap>(),
    {
      title: 'Keys',
      key: 'keys',
      render: (_, r) => {
        const keys = Object.keys(r.data ?? {})
        return (
          <div>
            {keys.slice(0, 4).map((k) => <Tag key={k} style={{ fontSize: 11 }}>{k}</Tag>)}
            {keys.length > 4 && <Tag>+{keys.length - 4}</Tag>}
          </div>
        )
      },
    },
    ageCol<ConfigMap>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>ConfigMaps</Title>
      </div>
      <ResourceTable<ConfigMap>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await configApi.deleteConfigMap(r.metadata.namespace!, r.metadata.name); load() }}
        extraActions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create</Button>
        }
      />
      <Modal
        title="Create ConfigMap"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setCreateOpen(false)}>Cancel</Button>,
          <Button key="create" type="primary" onClick={async () => {
            try {
              await configApi.createConfigMap(createYaml)
              message.success('ConfigMap created'); setCreateOpen(false); load()
            } catch (e: unknown) {
              const err = e as { response?: { data?: { error?: string } } }
              message.error(err?.response?.data?.error ?? 'Create failed')
            }
          }}>Apply</Button>,
        ]}
        styles={{ body: { padding: 0 } }}
      >
        <YamlEditor value={createYaml} onChange={setCreateYaml} height={450} />
      </Modal>
    </div>
  )
}

// ── Secrets ───────────────────────────────────────────────────────────────────

export function Secrets() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Secret[]>([])
  const [loading, setLoading] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    configApi.listSecrets(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<Secret>).items))
      .catch(() => message.error('Failed to load Secrets'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  async function revealKey(namespace: string, secretName: string, key: string) {
    try {
      const res = await configApi.revealSecretKey(namespace, secretName, key)
      setRevealedKeys((prev) => ({ ...prev, [`${secretName}/${key}`]: res.data.raw }))
    } catch {
      message.error('Failed to reveal secret value')
    }
  }

  const columns: ColumnType<Secret>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<Secret>(),
    {
      title: 'Type',
      key: 'type',
      render: (_, r) => <Tag style={{ fontSize: 11 }}>{r.type ?? 'Opaque'}</Tag>,
    },
    {
      title: 'Keys',
      key: 'keys',
      render: (_, r) => {
        const keys = Object.keys(r.data ?? {})
        return (
          <Space wrap>
            {keys.slice(0, 3).map((k) => {
              const revealKey2 = `${r.metadata.name}/${k}`
              const revealed = revealedKeys[revealKey2]
              return (
                <Tag key={k} style={{ fontSize: 11 }}>
                  {k}
                  <Tooltip title={revealed ? 'Hide' : 'Reveal value'}>
                    <Button
                      type="link" size="small"
                      icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      style={{ padding: '0 4px', height: 16 }}
                      onClick={() => {
                        if (revealed) {
                          setRevealedKeys((prev) => { const n = { ...prev }; delete n[revealKey2]; return n })
                        } else {
                          revealKey(r.metadata.namespace!, r.metadata.name, k)
                        }
                      }}
                    />
                  </Tooltip>
                  {revealed && (
                    <span style={{ color: '#52c41a', marginLeft: 4, fontFamily: 'monospace', fontSize: 10 }}>
                      {revealed.slice(0, 20)}{revealed.length > 20 ? '…' : ''}
                    </span>
                  )}
                </Tag>
              )
            })}
            {keys.length > 3 && <Tag>+{keys.length - 3}</Tag>}
          </Space>
        )
      },
    },
    ageCol<Secret>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Secrets</Title>
      </div>
      <ResourceTable<Secret>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await configApi.deleteSecret(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── PVs ───────────────────────────────────────────────────────────────────────

export function PersistentVolumes() {
  const [data, setData] = useState<PersistentVolume[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    configApi.listPVs()
      .then((res) => setData((res.data as KubeList<PersistentVolume>).items))
      .catch(() => message.error('Failed to load PVs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const pvPhaseColor: Record<string, string> = { Available: 'blue', Bound: 'green', Released: 'orange', Failed: 'red' }

  const columns: ColumnType<PersistentVolume>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    {
      title: 'Capacity',
      key: 'capacity',
      render: (_, r) => <Tag color="blue">{r.spec?.capacity?.storage ?? '—'}</Tag>,
    },
    {
      title: 'Access Modes',
      key: 'access',
      render: (_, r) => r.spec?.accessModes?.map((m) => <Tag key={m} style={{ fontSize: 11 }}>{m}</Tag>),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => <Tag color={pvPhaseColor[r.status?.phase ?? 'Available']}>{r.status?.phase}</Tag>,
    },
    {
      title: 'Claim',
      key: 'claim',
      render: (_, r) => r.spec?.claimRef ? (
        <span style={{ fontSize: 12 }}>{r.spec.claimRef.namespace}/{r.spec.claimRef.name}</span>
      ) : '—',
    },
    { title: 'Storage Class', key: 'sc', render: (_, r) => <Tag>{r.spec?.storageClassName ?? '—'}</Tag> },
    ageCol<PersistentVolume>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Persistent Volumes</Title>
      </div>
      <ResourceTable<PersistentVolume>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await configApi.deletePV(r.metadata.name); load() }}
      />
    </div>
  )
}

// ── PVCs ──────────────────────────────────────────────────────────────────────

export function PersistentVolumeClaims() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<PersistentVolumeClaim[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    configApi.listPVCs(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<PersistentVolumeClaim>).items))
      .catch(() => message.error('Failed to load PVCs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const pvcPhaseColor: Record<string, string> = { Bound: 'green', Pending: 'orange', Lost: 'red' }

  const columns: ColumnType<PersistentVolumeClaim>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<PersistentVolumeClaim>(),
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => <Tag color={pvcPhaseColor[r.status?.phase ?? 'Pending']}>{r.status?.phase}</Tag>,
    },
    {
      title: 'Volume',
      key: 'volume',
      render: (_, r) => <span style={{ color: '#8b949e', fontSize: 12 }}>{r.spec?.volumeName ?? '—'}</span>,
    },
    {
      title: 'Capacity',
      key: 'capacity',
      render: (_, r) => (
        <Tag color="blue">
          {r.status?.capacity?.storage ?? r.spec?.resources?.requests?.storage ?? '—'}
        </Tag>
      ),
    },
    { title: 'Storage Class', key: 'sc', render: (_, r) => <Tag>{r.spec?.storageClassName ?? '—'}</Tag> },
    ageCol<PersistentVolumeClaim>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Persistent Volume Claims</Title>
      </div>
      <ResourceTable<PersistentVolumeClaim>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await configApi.deletePVC(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── StorageClasses ────────────────────────────────────────────────────────────

export function StorageClasses() {
  const [data, setData] = useState<StorageClass[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    configApi.listStorageClasses()
      .then((res) => setData((res.data as KubeList<StorageClass>).items))
      .catch(() => message.error('Failed to load StorageClasses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const columns: ColumnType<StorageClass>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    { title: 'Provisioner', key: 'provisioner', render: (_, r) => <Tag style={{ fontSize: 11 }}>{r.provisioner}</Tag> },
    { title: 'Reclaim Policy', key: 'reclaim', render: (_, r) => <Tag>{r.reclaimPolicy ?? '—'}</Tag> },
    { title: 'Volume Binding', key: 'binding', render: (_, r) => <Tag>{r.volumeBindingMode ?? '—'}</Tag> },
    {
      title: 'Expandable',
      key: 'expand',
      render: (_, r) => r.allowVolumeExpansion ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>,
    },
    ageCol<StorageClass>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Storage Classes</Title>
      </div>
      <ResourceTable<StorageClass>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await configApi.deleteStorageClass(r.metadata.name); load() }}
      />
    </div>
  )
}

const defaultConfigMapYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
data:
  APP_ENV: production
  LOG_LEVEL: info
  config.yaml: |
    server:
      port: 8080
`
