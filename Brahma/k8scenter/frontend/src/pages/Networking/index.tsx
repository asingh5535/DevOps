import React, { useEffect, useState } from 'react'
import { Tag, Typography, message } from 'antd'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { namespaceCol, ageCol } from '@/components/ResourceTable'
import { serviceApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type { Service, Ingress, KubeList, KubeResource } from '@/types'

const { Title } = Typography

// ── Services ──────────────────────────────────────────────────────────────────

export function Services() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    serviceApi.listServices(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<Service>).items))
      .catch(() => message.error('Failed to load services'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const serviceTypeColor: Record<string, string> = {
    ClusterIP: 'blue', NodePort: 'orange', LoadBalancer: 'green', ExternalName: 'purple',
  }

  const columns: ColumnType<Service>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<Service>(),
    {
      title: 'Type',
      key: 'type',
      render: (_, r) => <Tag color={serviceTypeColor[r.spec?.type ?? 'ClusterIP']}>{r.spec?.type ?? 'ClusterIP'}</Tag>,
    },
    {
      title: 'Cluster IP',
      key: 'clusterIP',
      render: (_, r) => <span style={{ fontFamily: 'monospace', color: '#8b949e', fontSize: 12 }}>{r.spec?.clusterIP ?? '—'}</span>,
    },
    {
      title: 'Ports',
      key: 'ports',
      render: (_, r) => (
        <div>
          {r.spec?.ports?.map((p, i) => (
            <Tag key={i} style={{ fontSize: 11 }}>
              {p.port}{p.nodePort ? `:${p.nodePort}` : ''}/{p.protocol ?? 'TCP'}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'External IP',
      key: 'externalIP',
      render: (_, r) => {
        const lb = r.status?.loadBalancer?.ingress?.[0]
        if (lb) return <Tag color="green">{lb.ip ?? lb.hostname}</Tag>
        return <span style={{ color: '#8b949e' }}>—</span>
      },
    },
    ageCol<Service>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Services</Title>
      </div>
      <ResourceTable<Service>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await serviceApi.deleteService(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── Ingresses ─────────────────────────────────────────────────────────────────

export function Ingresses() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Ingress[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    serviceApi.listIngresses(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<Ingress>).items))
      .catch(() => message.error('Failed to load ingresses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<Ingress>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<Ingress>(),
    {
      title: 'Class',
      key: 'class',
      render: (_, r) => <Tag>{r.spec?.ingressClassName ?? 'default'}</Tag>,
    },
    {
      title: 'Hosts',
      key: 'hosts',
      render: (_, r) => (
        <div>
          {r.spec?.rules?.map((rule, i) => (
            <Tag key={i} color="blue" style={{ fontSize: 11 }}>{rule.host ?? '*'}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'TLS',
      key: 'tls',
      render: (_, r) => r.spec?.tls ? <Tag color="green">TLS</Tag> : <span style={{ color: '#8b949e' }}>—</span>,
    },
    {
      title: 'Address',
      key: 'address',
      render: (_, r) => {
        const lb = r.status?.loadBalancer?.ingress?.[0]
        return lb ? <Tag color="cyan">{lb.ip ?? lb.hostname}</Tag> : <span style={{ color: '#8b949e' }}>—</span>
      },
    },
    ageCol<Ingress>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Ingresses</Title>
      </div>
      <ResourceTable<Ingress>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await serviceApi.deleteIngress(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── Network Policies ──────────────────────────────────────────────────────────

export function NetworkPolicies() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<KubeResource[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    serviceApi.listNetworkPolicies(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<KubeResource>).items))
      .catch(() => message.error('Failed to load network policies'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<KubeResource>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<KubeResource>(),
    ageCol<KubeResource>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Network Policies</Title>
      </div>
      <ResourceTable<KubeResource>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await serviceApi.deleteNetworkPolicy(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}
