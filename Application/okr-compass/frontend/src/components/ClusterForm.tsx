import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import type { ConnectorTypeInfo } from '@/types'
import { clusterApi, connectorApi } from '@/services/api'

export default function ClusterForm({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm()
  const [types, setTypes] = useState<ConnectorTypeInfo[]>([])
  const [selectedType, setSelectedType] = useState<ConnectorTypeInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    connectorApi.listTypes().then((res) => setTypes(res.data)).catch(() => {})
  }, [open])

  const handleTypeChange = (typeKey: string) => {
    const info = types.find((t) => t.type === typeKey) ?? null
    setSelectedType(info)
    if (info?.defaultPort) form.setFieldValue('port', info.defaultPort)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const extra: Record<string, string> = {}
      for (const field of selectedType?.fields ?? []) {
        if (values[`extra_${field.key}`] !== undefined) {
          extra[field.key] = String(values[`extra_${field.key}`])
        }
      }

      await clusterApi.create({
        name: values.name,
        type: values.type,
        host: values.host,
        port: values.port,
        username: values.username,
        password: values.password,
        extra,
      })
      message.success('Cluster added')
      form.resetFields()
      setSelectedType(null)
      onCreated()
      onClose()
    } catch (err: any) {
      if (err?.errorFields) return // antd validation error, already shown inline
      message.error(err.response?.data?.error ?? 'Failed to add cluster')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Add Cluster"
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="type" label="Connector Type" rules={[{ required: true }]}>
          <Select
            options={types.map((t) => ({ value: t.type, label: t.label }))}
            onChange={handleTypeChange}
            placeholder="Select a system"
          />
        </Form.Item>
        <Form.Item name="name" label="Display Name" rules={[{ required: true }]}>
          <Input placeholder="e.g. prod-clickhouse-01" />
        </Form.Item>
        <Form.Item name="host" label="Host" rules={[{ required: true }]}>
          <Input placeholder="e.g. clickhouse.internal or https://k8s-api.internal" />
        </Form.Item>
        <Form.Item name="port" label="Port">
          <InputNumber style={{ width: '100%' }} min={0} max={65535} />
        </Form.Item>
        {selectedType?.usesUsername && (
          <Form.Item name="username" label="Username">
            <Input />
          </Form.Item>
        )}
        <Form.Item name="password" label={selectedType?.passwordLabel ?? 'Password / Token / Secret'}>
          <Input.Password />
        </Form.Item>
        {selectedType?.fields?.map((field) => (
          <Form.Item
            key={field.key}
            name={`extra_${field.key}`}
            label={field.label}
            rules={field.required ? [{ required: true }] : []}
          >
            {field.secret ? <Input.TextArea rows={3} placeholder={field.placeholder} /> : <Input placeholder={field.placeholder} />}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  )
}
