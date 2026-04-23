import React, { useState } from 'react'
import {
  Table, Button, Space, Popconfirm, Tooltip, Tag, Input, Typography,
  Dropdown, Modal, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, EyeOutlined, SearchOutlined,
  ReloadOutlined, MoreOutlined, CopyOutlined, CodeOutlined,
} from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import YamlEditor from '@/components/YamlEditor'
import { toYAML, formatAge, copyToClipboard } from '@/utils'
import type { KubeResource } from '@/types'

interface ResourceTableProps<T extends KubeResource> {
  data: T[]
  columns: ColumnType<T>[]
  loading?: boolean
  onRefresh?: () => void
  onDelete?: (record: T) => Promise<void>
  onEdit?: (record: T, newYaml: string) => Promise<void>
  rowKey?: (record: T) => string
  title?: string
  extraActions?: React.ReactNode
  searchKeys?: Array<keyof T['metadata']>
}

export default function ResourceTable<T extends KubeResource>({
  data,
  columns,
  loading,
  onRefresh,
  onDelete,
  onEdit,
  rowKey,
  title,
  extraActions,
  searchKeys = ['name'],
}: ResourceTableProps<T>) {
  const [search, setSearch] = useState('')
  const [editRecord, setEditRecord] = useState<T | null>(null)
  const [editYaml, setEditYaml] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = data.filter((item) => {
    if (!search) return true
    return searchKeys.some((k) => {
      const val = item.metadata[k as keyof typeof item.metadata]
      return typeof val === 'string' && val.toLowerCase().includes(search.toLowerCase())
    })
  })

  const actionColumn: ColumnType<T> = {
    title: 'Actions',
    key: 'actions',
    width: 120,
    align: 'center',
    render: (_, record) => {
      const menuItems = [
        {
          key: 'view',
          label: 'View YAML',
          icon: <EyeOutlined />,
          onClick: () => {
            setEditYaml(toYAML(record))
            setEditRecord(record)
          },
        },
        {
          key: 'copy',
          label: 'Copy Name',
          icon: <CopyOutlined />,
          onClick: () => copyToClipboard(record.metadata.name).then(() => message.success('Copied')),
        },
        ...(onEdit
          ? [{
              key: 'edit',
              label: 'Edit',
              icon: <EditOutlined />,
              onClick: () => {
                setEditYaml(toYAML(record))
                setEditRecord(record)
              },
            }]
          : []),
        ...(onDelete
          ? [{ type: 'divider' as const }]
          : []),
      ]

      return (
        <Space size={4}>
          <Tooltip title="View YAML">
            <Button
              type="text" size="small" icon={<CodeOutlined />}
              onClick={() => { setEditYaml(toYAML(record)); setEditRecord(record) }}
            />
          </Tooltip>
          {onDelete && (
            <Popconfirm
              title={`Delete ${record.metadata.name}?`}
              description="This action cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={async () => {
                try {
                  await onDelete(record)
                  message.success('Deleted successfully')
                } catch (err: unknown) {
                  const e = err as { response?: { data?: { error?: string } } }
                  message.error(e?.response?.data?.error ?? 'Delete failed')
                }
              }}
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      )
    },
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          {title && <Typography.Text strong style={{ fontSize: 16 }}>{title}</Typography.Text>}
          <Tag>{filtered.length} items</Tag>
        </Space>
        <Space>
          {extraActions}
          <Input
            placeholder="Search by name..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          {onRefresh && (
            <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
              Refresh
            </Button>
          )}
        </Space>
      </div>

      <Table<T>
        dataSource={filtered}
        columns={[...columns, actionColumn]}
        loading={loading}
        rowKey={rowKey ?? ((r) => r.metadata.uid ?? r.metadata.name)}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `${total} resources`,
        }}
        scroll={{ x: 'max-content' }}
        style={{ background: '#141414' }}
      />

      {/* YAML viewer/editor modal */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            {editRecord?.metadata.name}
            {editRecord?.metadata.namespace && (
              <Tag color="blue">{editRecord.metadata.namespace}</Tag>
            )}
          </Space>
        }
        open={!!editRecord}
        onCancel={() => { setEditRecord(null); setEditYaml('') }}
        width={900}
        footer={
          onEdit
            ? [
                <Button key="cancel" onClick={() => { setEditRecord(null); setEditYaml('') }}>
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  loading={saving}
                  onClick={async () => {
                    if (!editRecord || !onEdit) return
                    setSaving(true)
                    try {
                      await onEdit(editRecord, editYaml)
                      message.success('Saved')
                      setEditRecord(null)
                    } catch (err: unknown) {
                      const e = err as { response?: { data?: { error?: string } } }
                      message.error(e?.response?.data?.error ?? 'Save failed')
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Apply
                </Button>,
              ]
            : null
        }
        styles={{ body: { padding: 0 } }}
      >
        <YamlEditor value={editYaml} onChange={setEditYaml} readOnly={!onEdit} height={550} />
      </Modal>
    </>
  )
}

// ── Shared column helpers ──────────────────────────────────────────────────────

export function namespaceCol<T extends KubeResource>(): ColumnType<T> {
  return {
    title: 'Namespace',
    key: 'namespace',
    width: 130,
    render: (_, r) => (
      <Tag color="blue" style={{ fontSize: 11 }}>{r.metadata.namespace ?? '—'}</Tag>
    ),
  }
}

export function ageCol<T extends KubeResource>(): ColumnType<T> {
  return {
    title: 'Age',
    key: 'age',
    width: 100,
    sorter: (a, b) =>
      new Date(a.metadata.creationTimestamp ?? 0).getTime() -
      new Date(b.metadata.creationTimestamp ?? 0).getTime(),
    render: (_, r) => (
      <Tooltip title={r.metadata.creationTimestamp}>
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          {formatAge(r.metadata.creationTimestamp)}
        </span>
      </Tooltip>
    ),
  }
}

export function labelsCol<T extends KubeResource>(): ColumnType<T> {
  return {
    title: 'Labels',
    key: 'labels',
    render: (_, r) => (
      <Space size={2} wrap>
        {Object.entries(r.metadata.labels ?? {}).slice(0, 3).map(([k, v]) => (
          <Tag key={k} style={{ fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {k}={v}
          </Tag>
        ))}
        {Object.keys(r.metadata.labels ?? {}).length > 3 && (
          <Tag>+{Object.keys(r.metadata.labels!).length - 3}</Tag>
        )}
      </Space>
    ),
  }
}
