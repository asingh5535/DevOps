import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import type { Cluster, MetricSpec } from '@/types'
import { clusterApi, connectorApi, keyResultApi } from '@/services/api'

const comparatorOptions = [
  { value: 'lt', label: '< less than (lower is better)' },
  { value: 'lte', label: '≤ less than or equal' },
  { value: 'gt', label: '> greater than (higher is better)' },
  { value: 'gte', label: '≥ greater than or equal' },
]

export default function KeyResultBuilder({ open, objectiveId, onClose, onCreated }: {
  open: boolean
  objectiveId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [metrics, setMetrics] = useState<MetricSpec[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    clusterApi.list().then((res) => setClusters(res.data ?? [])).catch(() => {})
  }, [open])

  const handleClusterChange = async (clusterId: string) => {
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    try {
      const res = await connectorApi.listMetrics(cluster.type)
      setMetrics(res.data ?? [])
    } catch {
      setMetrics([])
    }
  }

  const handleMetricChange = (metricKey: string) => {
    const metric = metrics.find((m) => m.key === metricKey)
    if (metric) form.setFieldValue('unit', metric.unit)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await keyResultApi.create(objectiveId, {
        title: values.title,
        clusterId: values.clusterId,
        metricKey: values.metricKey,
        comparator: values.comparator,
        baselineValue: values.baselineValue,
        targetValue: values.targetValue,
        unit: values.unit,
      })
      message.success('Key result added')
      form.resetFields()
      setMetrics([])
      onCreated()
      onClose()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.response?.data?.error ?? 'Failed to add key result')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Add Key Result"
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={submitting}
      destroyOnClose
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Key Result Title" rules={[{ required: true }]}>
          <Input placeholder="e.g. Cut p99 query latency to under 200ms" />
        </Form.Item>
        <Form.Item name="clusterId" label="Cluster" rules={[{ required: true }]}>
          <Select
            options={clusters.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` }))}
            onChange={handleClusterChange}
            placeholder="Pick a registered cluster"
          />
        </Form.Item>
        <Form.Item name="metricKey" label="Metric" rules={[{ required: true }]}>
          <Select
            options={metrics.map((m) => ({ value: m.key, label: `${m.name} (${m.unit})` }))}
            onChange={handleMetricChange}
            placeholder="Pick a metric from that cluster's connector"
            notFoundContent="Select a cluster first"
          />
        </Form.Item>
        <Form.Item name="comparator" label="Comparator" rules={[{ required: true }]}>
          <Select options={comparatorOptions} placeholder="How the target compares to the reading" />
        </Form.Item>
        <Form.Item name="baselineValue" label="Baseline Value" rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} placeholder="Starting point (0% progress)" />
        </Form.Item>
        <Form.Item name="targetValue" label="Target Value" rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} placeholder="Goal (100% progress)" />
        </Form.Item>
        <Form.Item name="unit" label="Unit">
          <Input placeholder="auto-filled from metric" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
