import React, { useEffect, useState } from 'react'
import { Tag, Progress, Typography, message, Badge, Space } from 'antd'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { ageCol } from '@/components/ResourceTable'
import { clusterApi } from '@/services/api'
import type { Node, KubeList } from '@/types'
import { parseCPU, parseMemory, formatBytes } from '@/utils'

const { Title } = Typography

export default function Nodes() {
  const [data, setData] = useState<Node[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    clusterApi.listNodes()
      .then((res) => setData((res.data as KubeList<Node>).items))
      .catch(() => message.error('Failed to load nodes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function getNodeStatus(node: Node): 'Ready' | 'NotReady' | 'Unknown' {
    const cond = node.status?.conditions?.find((c) => c.type === 'Ready')
    if (!cond) return 'Unknown'
    if (cond.status === 'True') return 'Ready'
    return 'NotReady'
  }

  function getNodeAddress(node: Node): string {
    const addr = node.status?.addresses?.find((a) => a.type === 'InternalIP')
    return addr?.address ?? '—'
  }

  const columns: ColumnType<Node>[] = [
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const status = getNodeStatus(r)
        return (
          <Badge
            status={status === 'Ready' ? 'success' : 'error'}
            text={
              <span style={{ color: status === 'Ready' ? '#52c41a' : '#ff4d4f' }}>{status}</span>
            }
          />
        )
      },
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_, r) => {
        const roles = Object.keys(r.metadata.labels ?? {})
          .filter((k) => k.startsWith('node-role.kubernetes.io/'))
          .map((k) => k.replace('node-role.kubernetes.io/', ''))
        return (
          <Space size={2}>
            {roles.map((role) => (
              <Tag key={role} color={role === 'control-plane' || role === 'master' ? 'gold' : 'blue'}>
                {role}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'IP',
      key: 'ip',
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace', color: '#8b949e', fontSize: 12 }}>
          {getNodeAddress(r)}
        </span>
      ),
    },
    {
      title: 'CPU',
      key: 'cpu',
      render: (_, r) => {
        const cap = r.status?.capacity?.cpu ?? '0'
        return (
          <Space>
            <Tag>{cap} cores</Tag>
          </Space>
        )
      },
    },
    {
      title: 'Memory',
      key: 'memory',
      render: (_, r) => {
        const mem = r.status?.capacity?.memory ?? '0'
        return <Tag>{formatBytes(parseMemory(mem))}</Tag>
      },
    },
    {
      title: 'OS',
      key: 'os',
      render: (_, r) => (
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          {r.status?.nodeInfo?.osImage ?? '—'}
        </span>
      ),
    },
    {
      title: 'K8s Version',
      key: 'version',
      render: (_, r) => (
        <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {r.status?.nodeInfo?.kubeletVersion ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Runtime',
      key: 'runtime',
      render: (_, r) => (
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          {r.status?.nodeInfo?.containerRuntimeVersion ?? '—'}
        </span>
      ),
    },
    {
      title: 'Schedulable',
      key: 'schedulable',
      render: (_, r) => r.spec?.unschedulable
        ? <Tag color="orange">Cordoned</Tag>
        : <Tag color="green">Schedulable</Tag>,
    },
    ageCol<Node>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Nodes</Title>
      </div>

      <ResourceTable<Node>
        data={data}
        columns={columns}
        loading={loading}
        onRefresh={load}
      />
    </div>
  )
}
