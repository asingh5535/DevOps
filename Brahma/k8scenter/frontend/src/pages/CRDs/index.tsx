import React, { useEffect, useState } from 'react'
import { Tag, Typography, Collapse, Table, message, Space, Button, Modal } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { ageCol } from '@/components/ResourceTable'
import YamlEditor from '@/components/YamlEditor'
import { crdApi } from '@/services/api'
import type { CRD, KubeList, KubeResource } from '@/types'

const { Title } = Typography

export default function CRDs() {
  const [crds, setCRDs] = useState<CRD[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCRD, setSelectedCRD] = useState<CRD | null>(null)
  const [instances, setInstances] = useState<KubeResource[]>([])
  const [instancesLoading, setInstancesLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createYaml, setCreateYaml] = useState(defaultCRDYaml)

  const load = () => {
    setLoading(true)
    crdApi.listCRDs()
      .then((res) => setCRDs((res.data as KubeList<CRD>).items))
      .catch(() => message.error('Failed to load CRDs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function loadInstances(crd: CRD) {
    setSelectedCRD(crd)
    setInstancesLoading(true)
    const group = crd.spec?.group ?? ''
    const version = crd.spec?.versions?.[0]?.name ?? 'v1'
    const resource = crd.spec?.names.plural ?? ''
    try {
      const res = await crdApi.listCustomResources(group, version, resource)
      setInstances((res.data as KubeList<KubeResource>).items)
    } catch {
      setInstances([])
    } finally {
      setInstancesLoading(false)
    }
  }

  const columns: ColumnType<CRD>[] = [
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => (
        <Button type="link" style={{ padding: 0, color: '#58a6ff' }} onClick={() => loadInstances(r)}>
          {r.metadata.name}
        </Button>
      ),
    },
    {
      title: 'Group',
      key: 'group',
      render: (_, r) => <Tag style={{ fontSize: 11 }}>{r.spec?.group}</Tag>,
    },
    {
      title: 'Kind',
      key: 'kind',
      render: (_, r) => <Tag color="purple">{r.spec?.names.kind}</Tag>,
    },
    {
      title: 'Scope',
      key: 'scope',
      render: (_, r) => (
        <Tag color={r.spec?.scope === 'Namespaced' ? 'blue' : 'orange'}>
          {r.spec?.scope}
        </Tag>
      ),
    },
    {
      title: 'Versions',
      key: 'versions',
      render: (_, r) => (
        <Space size={2}>
          {r.spec?.versions?.map((v) => (
            <Tag key={v.name} color={v.storage ? 'green' : 'default'} style={{ fontSize: 10 }}>
              {v.name}{v.storage ? ' (storage)' : ''}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Established',
      key: 'established',
      render: (_, r) => {
        const cond = r.status?.conditions?.find((c) => c.type === 'Established')
        return cond?.status === 'True'
          ? <Tag color="green">Yes</Tag>
          : <Tag color="red">No</Tag>
      },
    },
    ageCol<CRD>(),
  ]

  const instanceColumns: ColumnType<KubeResource>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3' }}>{r.metadata.name}</span> },
    { title: 'Namespace', key: 'ns', render: (_, r) => <Tag color="blue">{r.metadata.namespace ?? '—'}</Tag> },
    ageCol<KubeResource>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Custom Resource Definitions</Title>
      </div>

      <ResourceTable<CRD>
        data={crds}
        columns={columns}
        loading={loading}
        onRefresh={load}
        onDelete={async (r) => { await crdApi.deleteCRD(r.metadata.name); load() }}
        extraActions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Create CRD
          </Button>
        }
      />

      {/* Instances drawer */}
      {selectedCRD && (
        <div style={{
          marginTop: 24,
          background: '#161b22',
          border: '1px solid #21262d',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Tag color="purple">{selectedCRD.spec?.names.kind}</Tag>
              <Title level={5} style={{ margin: 0, color: '#e6edf3' }}>
                {selectedCRD.spec?.names.plural} instances
              </Title>
            </Space>
            <Button size="small" onClick={() => setSelectedCRD(null)}>Close</Button>
          </div>
          <Table
            dataSource={instances}
            columns={instanceColumns}
            loading={instancesLoading}
            rowKey={(r) => r.metadata.uid ?? r.metadata.name}
            size="small"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <span style={{ color: '#8b949e' }}>No instances found</span> }}
          />
        </div>
      )}

      <Modal
        title="Create Custom Resource Definition"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setCreateOpen(false)}>Cancel</Button>,
          <Button key="create" type="primary" onClick={async () => {
            try {
              await crdApi.listCRDs() // just a check
              message.info('Use kubectl apply for CRD creation, or the API will apply it')
              setCreateOpen(false)
            } catch {
              message.error('Failed')
            }
          }}>Apply</Button>,
        ]}
        styles={{ body: { padding: 0 } }}
      >
        <YamlEditor value={createYaml} onChange={setCreateYaml} height={500} />
      </Modal>
    </div>
  )
}

const defaultCRDYaml = `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: myresources.example.com
spec:
  group: example.com
  names:
    kind: MyResource
    plural: myresources
    singular: myresource
    shortNames:
    - mr
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              replicas:
                type: integer
              image:
                type: string
`
