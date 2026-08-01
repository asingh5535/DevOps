import { useEffect, useState } from 'react'
import { Card, Progress, Space, Button, Tag, Tooltip, message } from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import type { KeyResult, MetricSample } from '@/types'
import { keyResultApi } from '@/services/api'
import MetricSparkline from './MetricSparkline'

const comparatorLabel: Record<KeyResult['comparator'], string> = {
  lt: '<', lte: '≤', gt: '>', gte: '≥',
}

export default function ProgressCard({ keyResult, onChanged }: { keyResult: KeyResult; onChanged: () => void }) {
  const [samples, setSamples] = useState<MetricSample[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    keyResultApi.history(keyResult.id).then((res) => setSamples(res.data)).catch(() => {})
  }, [keyResult.id, keyResult.lastEvaluatedAt])

  const evaluate = async () => {
    setBusy(true)
    try {
      await keyResultApi.evaluate(keyResult.id)
      onChanged()
    } catch (err: any) {
      message.error(err.response?.data?.error ?? 'Evaluation failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await keyResultApi.remove(keyResult.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const progressStatus = keyResult.lastError ? 'exception' : keyResult.progress >= 100 ? 'success' : 'active'

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{keyResult.title}</div>
            <Tag color="blue" style={{ marginTop: 4 }}>{keyResult.clusterName ?? keyResult.clusterId}</Tag>
            <Tag>{keyResult.metricKey}</Tag>
          </div>
          <Space>
            <Tooltip title="Evaluate now">
              <Button icon={<ReloadOutlined />} size="small" loading={busy} onClick={evaluate} />
            </Tooltip>
            <Tooltip title="Delete key result">
              <Button icon={<DeleteOutlined />} size="small" danger loading={busy} onClick={remove} />
            </Tooltip>
          </Space>
        </Space>

        <Progress percent={Math.round(keyResult.progress)} status={progressStatus} />

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#8b949e' }}>
            Current: <strong>{keyResult.currentValue.toFixed(2)} {keyResult.unit}</strong>
            {' '}&mdash; Target: {comparatorLabel[keyResult.comparator]} {keyResult.targetValue} {keyResult.unit}
            {' '}(baseline {keyResult.baselineValue})
          </span>
          {keyResult.lastEvaluatedAt && (
            <span style={{ fontSize: 12, color: '#8b949e' }}>
              Last checked {new Date(keyResult.lastEvaluatedAt).toLocaleString()}
            </span>
          )}
        </Space>

        {keyResult.lastError && (
          <div style={{ color: '#ff7875', fontSize: 12 }}>Error: {keyResult.lastError}</div>
        )}

        <MetricSparkline samples={samples} />
      </Space>
    </Card>
  )
}
