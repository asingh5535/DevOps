import React, { useEffect, useState } from 'react'
import { Tag, Typography, message } from 'antd'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { namespaceCol, ageCol } from '@/components/ResourceTable'
import { workloadApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type { StatefulSet, DaemonSet, Job, CronJob, KubeList, KubeResource } from '@/types'

const { Title } = Typography

// ── StatefulSets ──────────────────────────────────────────────────────────────

export function StatefulSets() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<StatefulSet[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listStatefulSets(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<StatefulSet>).items))
      .catch(() => message.error('Failed to load StatefulSets'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<StatefulSet>[] = [
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span>,
    },
    namespaceCol<StatefulSet>(),
    {
      title: 'Replicas',
      key: 'replicas',
      render: (_, r) => {
        const ready = r.status?.readyReplicas ?? 0
        const total = r.spec?.replicas ?? 0
        return <span><span style={{ color: ready === total ? '#52c41a' : '#faad14' }}>{ready}</span> / {total}</span>
      },
    },
    { title: 'Service Name', key: 'svc', render: (_, r) => <Tag style={{ fontSize: 11 }}>{r.spec?.serviceName ?? '—'}</Tag> },
    ageCol<StatefulSet>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>StatefulSets</Title>
      </div>
      <ResourceTable<StatefulSet>
        data={data}
        columns={columns}
        loading={loading}
        onRefresh={load}
        onDelete={async (r) => { await workloadApi.deleteStatefulSet(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── DaemonSets ────────────────────────────────────────────────────────────────

export function DaemonSets() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<DaemonSet[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listDaemonSets(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<DaemonSet>).items))
      .catch(() => message.error('Failed to load DaemonSets'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<DaemonSet>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<DaemonSet>(),
    {
      title: 'Desired / Ready',
      key: 'ready',
      render: (_, r) => (
        <span>
          <span style={{ color: '#52c41a' }}>{r.status?.numberReady ?? 0}</span>
          {' / '}
          {r.status?.desiredNumberScheduled ?? 0}
        </span>
      ),
    },
    ageCol<DaemonSet>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>DaemonSets</Title>
      </div>
      <ResourceTable<DaemonSet>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await workloadApi.deleteDaemonSet(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── ReplicaSets ───────────────────────────────────────────────────────────────

export function ReplicaSets() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<KubeResource[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listReplicaSets(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<KubeResource>).items))
      .catch(() => message.error('Failed to load ReplicaSets'))
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
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>ReplicaSets</Title>
      </div>
      <ResourceTable<KubeResource> data={data} columns={columns} loading={loading} onRefresh={load} />
    </div>
  )
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function Jobs() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listJobs(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<Job>).items))
      .catch(() => message.error('Failed to load Jobs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<Job>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<Job>(),
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        if (r.status?.succeeded) return <Tag color="blue">Completed</Tag>
        if (r.status?.active) return <Tag color="green">Running ({r.status.active})</Tag>
        if (r.status?.failed) return <Tag color="red">Failed ({r.status.failed})</Tag>
        return <Tag>Pending</Tag>
      },
    },
    {
      title: 'Completions',
      key: 'completions',
      render: (_, r) => `${r.status?.succeeded ?? 0} / ${r.spec?.completions ?? 1}`,
    },
    ageCol<Job>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Jobs</Title>
      </div>
      <ResourceTable<Job>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await workloadApi.deleteJob(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── CronJobs ──────────────────────────────────────────────────────────────────

export function CronJobs() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    workloadApi.listCronJobs(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<CronJob>).items))
      .catch(() => message.error('Failed to load CronJobs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<CronJob>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<CronJob>(),
    {
      title: 'Schedule',
      key: 'schedule',
      render: (_, r) => <Tag style={{ fontFamily: 'monospace' }}>{r.spec?.schedule}</Tag>,
    },
    {
      title: 'Suspended',
      key: 'suspended',
      render: (_, r) => r.spec?.suspend ? <Tag color="orange">Suspended</Tag> : <Tag color="green">Active</Tag>,
    },
    {
      title: 'Last Schedule',
      key: 'lastSchedule',
      render: (_, r) => <span style={{ color: '#8b949e', fontSize: 12 }}>{r.status?.lastScheduleTime ?? '—'}</span>,
    },
    ageCol<CronJob>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>CronJobs</Title>
      </div>
      <ResourceTable<CronJob>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await workloadApi.deleteCronJob(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}
