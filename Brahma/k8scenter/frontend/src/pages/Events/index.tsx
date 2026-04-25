import React, { useEffect, useState } from 'react'
import { Table, Tag, Typography, Input, Select, Space, Button, Badge } from 'antd'
import { SearchOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { eventApi } from '@/services/api'
import { useNamespaceStore } from '@/store/namespace'
import type { KubeEvent, KubeList } from '@/types'
import { formatAge } from '@/utils'

const { Title } = Typography

export default function Events() {
  const { selectedNamespace } = useNamespaceStore()
  const [events, setEvents] = useState<KubeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const load = () => {
    setLoading(true)
    eventApi.listEvents(selectedNamespace || undefined)
      .then((res) => {
        const list = res.data as KubeList<KubeEvent>
        const sorted = [...list.items].sort((a, b) => {
          const aT = new Date(a.lastTimestamp ?? a.metadata.creationTimestamp ?? 0).getTime()
          const bT = new Date(b.lastTimestamp ?? b.metadata.creationTimestamp ?? 0).getTime()
          return bT - aT
        })
        setEvents(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedNamespace])

  const filtered = events.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        e.metadata.name?.toLowerCase().includes(s) ||
        e.reason?.toLowerCase().includes(s) ||
        e.message?.toLowerCase().includes(s) ||
        e.involvedObject?.name?.toLowerCase().includes(s)
      )
    }
    return true
  })

  const warningCount = events.filter((e) => e.type === 'Warning').length

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0, color: '#e6edf3' }}>Events</Title>
          {warningCount > 0 && (
            <Tag color="orange" icon={<WarningOutlined />}>
              {warningCount} warnings
            </Tag>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input
          placeholder="Search events..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'Normal', label: 'Normal' },
            { value: 'Warning', label: 'Warning' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        <Tag>{filtered.length} events</Tag>
      </div>

      <Table<KubeEvent>
        dataSource={filtered}
        rowKey={(r) => r.metadata.uid ?? r.metadata.name}
        size="small"
        loading={loading}
        pagination={{ pageSize: 30, showSizeChanger: true }}
        rowClassName={(r) => r.type === 'Warning' ? '' : ''}
        columns={[
          {
            title: 'Type',
            key: 'type',
            width: 90,
            render: (_, r) => (
              <Badge
                color={r.type === 'Warning' ? 'orange' : 'green'}
                text={<span style={{ color: r.type === 'Warning' ? '#faad14' : '#52c41a', fontSize: 12 }}>{r.type}</span>}
              />
            ),
          },
          {
            title: 'Reason',
            key: 'reason',
            width: 160,
            render: (_, r) => <Tag style={{ fontSize: 11 }}>{r.reason}</Tag>,
          },
          {
            title: 'Object',
            key: 'object',
            render: (_, r) => (
              <Space size={4}>
                <Tag color="blue" style={{ fontSize: 10 }}>{r.involvedObject?.kind}</Tag>
                <span style={{ color: '#e6edf3', fontSize: 12 }}>{r.involvedObject?.name}</span>
                {r.involvedObject?.namespace && (
                  <span style={{ color: '#8b949e', fontSize: 11 }}>({r.involvedObject.namespace})</span>
                )}
              </Space>
            ),
          },
          {
            title: 'Message',
            key: 'message',
            render: (_, r) => (
              <span style={{ color: '#cdd9e5', fontSize: 12 }}>{r.message}</span>
            ),
          },
          {
            title: 'Count',
            key: 'count',
            width: 70,
            render: (_, r) => (
              <span style={{ color: r.count && r.count > 1 ? '#faad14' : '#8b949e' }}>
                {r.count ?? 1}
              </span>
            ),
          },
          {
            title: 'Source',
            key: 'source',
            width: 130,
            render: (_, r) => (
              <span style={{ color: '#8b949e', fontSize: 11 }}>
                {r.source?.component}
              </span>
            ),
          },
          {
            title: 'Last Seen',
            key: 'lastSeen',
            width: 120,
            render: (_, r) => (
              <span style={{ color: '#8b949e', fontSize: 12 }}>
                {formatAge(r.lastTimestamp ?? r.metadata.creationTimestamp)}
              </span>
            ),
          },
        ]}
        style={{ background: '#141414' }}
      />
    </div>
  )
}
