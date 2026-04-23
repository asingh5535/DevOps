import React, { useEffect, useRef, useState } from 'react'
import { Button, Select, Space, Tooltip, Switch, Spin, Alert } from 'antd'
import {
  PauseOutlined, PlayCircleOutlined, DownloadOutlined,
  ClearOutlined, VerticalAlignBottomOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/auth'

interface LogViewerProps {
  namespace: string
  podName: string
  containers: string[]
  height?: number
}

export default function LogViewer({ namespace, podName, containers, height = 500 }: LogViewerProps) {
  const [container, setContainer] = useState(containers[0] ?? '')
  const [lines, setLines] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [timestamps, setTimestamps] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<string[]>([])
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [container, namespace, podName])

  function connect() {
    setLines([])
    setConnected(false)
    wsRef.current?.close()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = new URL(
      `${protocol}//${host}/api/pods/${namespace}/${podName}/logs/stream`
    )
    url.searchParams.set('container', container)
    url.searchParams.set('tail', '500')
    url.searchParams.set('timestamps', timestamps ? 'true' : 'false')
    if (token) url.searchParams.set('token', token)

    const ws = new WebSocket(url.toString())
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (e) => {
      if (paused) {
        pendingRef.current.push(e.data)
        return
      }
      setLines((prev) => [...prev.slice(-2000), e.data])
    }
  }

  function resume() {
    setPaused(false)
    setLines((prev) => [...prev, ...pendingRef.current].slice(-2000))
    pendingRef.current = []
  }

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, autoScroll])

  function download() {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${podName}-${container}.log`
    a.click()
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: '#161b22',
        border: '1px solid #21262d',
        borderBottom: 'none',
        borderRadius: '6px 6px 0 0',
      }}>
        <Space>
          <Select
            value={container}
            onChange={setContainer}
            style={{ width: 160 }}
            size="small"
            options={containers.map((c) => ({ value: c, label: c }))}
          />
          <span style={{ color: connected ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
            {connected ? '● Connected' : '● Disconnected'}
          </span>
          <span style={{ color: '#8b949e', fontSize: 12 }}>{lines.length} lines</span>
        </Space>
        <Space>
          <Tooltip title="Timestamps">
            <Space size={4}>
              <span style={{ color: '#8b949e', fontSize: 12 }}>Timestamps</span>
              <Switch size="small" checked={timestamps} onChange={setTimestamps} />
            </Space>
          </Tooltip>
          <Tooltip title="Auto-scroll">
            <Space size={4}>
              <VerticalAlignBottomOutlined style={{ color: '#8b949e' }} />
              <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
            </Space>
          </Tooltip>
          {paused ? (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={resume}>
              Resume ({pendingRef.current.length})
            </Button>
          ) : (
            <Button size="small" icon={<PauseOutlined />} onClick={() => setPaused(true)}>
              Pause
            </Button>
          )}
          <Button size="small" icon={<ClearOutlined />} onClick={() => setLines([])}>
            Clear
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={download}>
            Download
          </Button>
        </Space>
      </div>

      {/* Log area */}
      <div
        className="log-viewer"
        style={{ height, borderRadius: '0 0 6px 6px', overflow: 'auto' }}
      >
        {!connected && lines.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
            <div style={{ color: '#8b949e', marginTop: 8 }}>Connecting to log stream...</div>
          </div>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              lineHeight: 1.6,
              color: line.includes('ERROR') || line.includes('error')
                ? '#ff6b6b'
                : line.includes('WARN') || line.includes('warn')
                ? '#ffd93d'
                : '#d4d4d4',
            }}
          >
            {line}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
