import React, { useEffect, useState } from 'react'
import { Tag, Badge, Modal, Tabs, Typography, Space, Button, message, Tooltip, Spin } from 'antd'
import { CodeOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { namespaceCol, ageCol } from '@/components/ResourceTable'
import LogViewer from '@/components/LogViewer'
import Terminal from '@/components/Terminal'
import { workloadApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type { Pod, KubeList } from '@/types'
import { getPodStatus, getPodPhaseColor, getPodReadyCount } from '@/utils'

const { Title } = Typography

export default function Pods() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Pod[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
  const [containers, setContainers] = useState<string[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingContainers, setLoadingContainers] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listPods(selectedNamespace || undefined)
      .then((res) => {
        const list = res.data as KubeList<Pod>
        setData(list.items)
      })
      .catch(() => message.error('Failed to load pods'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  async function openPodDetail(pod: Pod) {
    setSelectedPod(pod)
    setModalOpen(true)
    setLoadingContainers(true)
    try {
      const res = await workloadApi.listContainers(pod.metadata.namespace!, pod.metadata.name)
      setContainers(res.data.containers ?? [])
    } catch {
      setContainers(pod.spec?.containers.map((c) => c.name) ?? [])
    } finally {
      setLoadingContainers(false)
    }
  }

  const columns: ColumnType<Pod>[] = [
    {
      title: 'Name',
      key: 'name',
      sorter: (a, b) => a.metadata.name.localeCompare(b.metadata.name),
      render: (_, r) => (
        <Button type="link" style={{ padding: 0, color: '#58a6ff' }} onClick={() => openPodDetail(r)}>
          {r.metadata.name}
        </Button>
      ),
    },
    namespaceCol<Pod>(),
    {
      title: 'Status',
      key: 'status',
      sorter: (a, b) => (a.status?.phase ?? '').localeCompare(b.status?.phase ?? ''),
      render: (_, r) => {
        const phase = getPodStatus(r)
        return (
          <span style={{ color: getPodPhaseColor(phase), fontWeight: 500 }}>
            {phase}
          </span>
        )
      },
    },
    {
      title: 'Ready',
      key: 'ready',
      width: 80,
      render: (_, r) => (
        <span style={{ color: '#8b949e' }}>{getPodReadyCount(r)}</span>
      ),
    },
    {
      title: 'Restarts',
      key: 'restarts',
      width: 90,
      render: (_, r) => {
        const restarts = r.status?.containerStatuses?.reduce((sum, s) => sum + (s.restartCount ?? 0), 0) ?? 0
        return (
          <span style={{ color: restarts > 0 ? '#faad14' : '#8b949e' }}>{restarts}</span>
        )
      },
    },
    {
      title: 'Node',
      key: 'node',
      render: (_, r) => (
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          {(r as unknown as { spec?: { nodeName?: string } }).spec?.nodeName ?? '—'}
        </span>
      ),
    },
    {
      title: 'IP',
      key: 'ip',
      width: 130,
      render: (_, r) => (
        <span style={{ color: '#8b949e', fontSize: 12, fontFamily: 'monospace' }}>
          {r.status?.podIP ?? '—'}
        </span>
      ),
    },
    ageCol<Pod>(),
  ]

  async function handleDelete(record: Pod) {
    await workloadApi.deletePod(record.metadata.namespace!, record.metadata.name)
    load()
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Pods</Title>
      </div>

      <ResourceTable<Pod>
        data={data}
        columns={columns}
        loading={loading}
        onRefresh={load}
        onDelete={handleDelete}
      />

      {/* Pod detail modal */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            {selectedPod?.metadata.name}
            <Tag color="blue">{selectedPod?.metadata.namespace}</Tag>
            <Tag color={getPodPhaseColor(selectedPod?.status?.phase)}>
              {selectedPod?.status?.phase}
            </Tag>
          </Space>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setSelectedPod(null) }}
        width={1000}
        footer={null}
        styles={{ body: { padding: '0' } }}
      >
        {loadingContainers ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : selectedPod && (
          <Tabs
            defaultActiveKey="logs"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'logs',
                label: <Space><FileTextOutlined /> Logs</Space>,
                children: (
                  <LogViewer
                    namespace={selectedPod.metadata.namespace!}
                    podName={selectedPod.metadata.name}
                    containers={containers}
                    height={450}
                  />
                ),
              },
              {
                key: 'terminal',
                label: <Space><ThunderboltOutlined /> Terminal</Space>,
                children: (
                  <Terminal
                    namespace={selectedPod.metadata.namespace!}
                    podName={selectedPod.metadata.name}
                    containers={containers}
                    height={420}
                  />
                ),
              },
              {
                key: 'containers',
                label: 'Containers',
                children: (
                  <div style={{ padding: '16px 0' }}>
                    {selectedPod.spec?.containers.map((ct) => {
                      const status = selectedPod.status?.containerStatuses?.find((s) => s.name === ct.name)
                      return (
                        <div key={ct.name} style={{
                          background: '#161b22',
                          border: '1px solid #21262d',
                          borderRadius: 8,
                          padding: 16,
                          marginBottom: 12,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#e6edf3', fontWeight: 600 }}>{ct.name}</span>
                            <Badge status={status?.ready ? 'success' : 'error'} text={status?.ready ? 'Ready' : 'Not Ready'} />
                          </div>
                          <div style={{ color: '#8b949e', fontSize: 12, marginTop: 8 }}>
                            <Tag style={{ fontSize: 11 }}>{ct.image}</Tag>
                            {status && (
                              <span style={{ marginLeft: 8 }}>Restarts: {status.restartCount}</span>
                            )}
                          </div>
                          {ct.resources && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                              <div style={{ fontSize: 12, color: '#8b949e' }}>
                                CPU: {ct.resources.requests?.cpu ?? '—'} / {ct.resources.limits?.cpu ?? '—'}
                              </div>
                              <div style={{ fontSize: 12, color: '#8b949e' }}>
                                Memory: {ct.resources.requests?.memory ?? '—'} / {ct.resources.limits?.memory ?? '—'}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}
