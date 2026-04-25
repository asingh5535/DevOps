import React, { useEffect, useState } from 'react'
import { Tag, Typography, message, Space } from 'antd'
import type { ColumnType } from 'antd/es/table'
import ResourceTable, { namespaceCol, ageCol } from '@/components/ResourceTable'
import { rbacApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type {
  ClusterRole, Role, ClusterRoleBinding, RoleBinding, ServiceAccount, KubeList,
} from '@/types'

const { Title } = Typography

function verbColor(verb: string): string {
  if (['get', 'list', 'watch'].includes(verb)) return 'blue'
  if (['create', 'update', 'patch'].includes(verb)) return 'orange'
  if (verb === 'delete') return 'red'
  if (verb === '*') return 'purple'
  return 'default'
}

// ── ClusterRoles ──────────────────────────────────────────────────────────────

export function ClusterRoles() {
  const [data, setData] = useState<ClusterRole[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    rbacApi.listClusterRoles()
      .then((res) => setData((res.data as KubeList<ClusterRole>).items))
      .catch(() => message.error('Failed to load ClusterRoles'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const columns: ColumnType<ClusterRole>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    {
      title: 'Rules',
      key: 'rules',
      render: (_, r) => {
        const rules = r.rules ?? []
        return (
          <span style={{ color: '#8b949e' }}>
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        )
      },
    },
    {
      title: 'Verbs (sample)',
      key: 'verbs',
      render: (_, r) => {
        const verbs = [...new Set((r.rules ?? []).flatMap((rule) => rule.verbs))]
        return (
          <Space size={2} wrap>
            {verbs.slice(0, 6).map((v) => (
              <Tag key={v} color={verbColor(v)} style={{ fontSize: 10 }}>{v}</Tag>
            ))}
            {verbs.length > 6 && <Tag>+{verbs.length - 6}</Tag>}
          </Space>
        )
      },
    },
    ageCol<ClusterRole>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Cluster Roles</Title>
      </div>
      <ResourceTable<ClusterRole>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await rbacApi.deleteClusterRole(r.metadata.name); load() }}
      />
    </div>
  )
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export function Roles() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    rbacApi.listRoles(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<Role>).items))
      .catch(() => message.error('Failed to load Roles'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<Role>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<Role>(),
    {
      title: 'Rules',
      key: 'rules',
      render: (_, r) => (
        <span style={{ color: '#8b949e' }}>
          {(r.rules ?? []).length} rule{(r.rules ?? []).length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      title: 'Resources (sample)',
      key: 'resources',
      render: (_, r) => {
        const resources = [...new Set((r.rules ?? []).flatMap((rule) => rule.resources ?? []))]
        return (
          <Space size={2} wrap>
            {resources.slice(0, 4).map((res) => (
              <Tag key={res} style={{ fontSize: 10 }}>{res}</Tag>
            ))}
            {resources.length > 4 && <Tag>+{resources.length - 4}</Tag>}
          </Space>
        )
      },
    },
    ageCol<Role>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Roles</Title>
      </div>
      <ResourceTable<Role>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await rbacApi.deleteRole(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── ClusterRoleBindings ───────────────────────────────────────────────────────

export function ClusterRoleBindings() {
  const [data, setData] = useState<ClusterRoleBinding[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    rbacApi.listClusterRoleBindings()
      .then((res) => setData((res.data as KubeList<ClusterRoleBinding>).items))
      .catch(() => message.error('Failed to load ClusterRoleBindings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const columns: ColumnType<ClusterRoleBinding>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    {
      title: 'Role',
      key: 'role',
      render: (_, r) => <Tag color="purple">{r.roleRef?.name}</Tag>,
    },
    {
      title: 'Subjects',
      key: 'subjects',
      render: (_, r) => (
        <Space wrap size={2}>
          {r.subjects?.map((s, i) => (
            <Tag key={i} color={s.kind === 'ServiceAccount' ? 'blue' : s.kind === 'User' ? 'green' : 'orange'} style={{ fontSize: 10 }}>
              {s.kind}: {s.name}
              {s.namespace && ` (${s.namespace})`}
            </Tag>
          ))}
        </Space>
      ),
    },
    ageCol<ClusterRoleBinding>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Cluster Role Bindings</Title>
      </div>
      <ResourceTable<ClusterRoleBinding>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await rbacApi.deleteClusterRoleBinding(r.metadata.name); load() }}
      />
    </div>
  )
}

// ── RoleBindings ──────────────────────────────────────────────────────────────

export function RoleBindings() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<RoleBinding[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    rbacApi.listRoleBindings(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<RoleBinding>).items))
      .catch(() => message.error('Failed to load RoleBindings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<RoleBinding>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<RoleBinding>(),
    { title: 'Role', key: 'role', render: (_, r) => <Tag color="purple">{r.roleRef?.name}</Tag> },
    {
      title: 'Subjects',
      key: 'subjects',
      render: (_, r) => (
        <Space wrap size={2}>
          {r.subjects?.map((s, i) => (
            <Tag key={i} color="blue" style={{ fontSize: 10 }}>{s.kind}: {s.name}</Tag>
          ))}
        </Space>
      ),
    },
    ageCol<RoleBinding>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Role Bindings</Title>
      </div>
      <ResourceTable<RoleBinding>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await rbacApi.deleteRoleBinding(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}

// ── ServiceAccounts ───────────────────────────────────────────────────────────

export function ServiceAccounts() {
  const { selectedNamespace } = useNamespaceStore()
  const [data, setData] = useState<ServiceAccount[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    rbacApi.listServiceAccounts(selectedNamespace || undefined)
      .then((res) => setData((res.data as KubeList<ServiceAccount>).items))
      .catch(() => message.error('Failed to load ServiceAccounts'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const columns: ColumnType<ServiceAccount>[] = [
    { title: 'Name', key: 'name', render: (_, r) => <span style={{ color: '#e6edf3', fontWeight: 500 }}>{r.metadata.name}</span> },
    namespaceCol<ServiceAccount>(),
    {
      title: 'Secrets',
      key: 'secrets',
      render: (_, r) => <span style={{ color: '#8b949e' }}>{r.secrets?.length ?? 0} secret(s)</span>,
    },
    ageCol<ServiceAccount>(),
  ]

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Service Accounts</Title>
      </div>
      <ResourceTable<ServiceAccount>
        data={data} columns={columns} loading={loading} onRefresh={load}
        onDelete={async (r) => { await rbacApi.deleteServiceAccount(r.metadata.namespace!, r.metadata.name); load() }}
      />
    </div>
  )
}
