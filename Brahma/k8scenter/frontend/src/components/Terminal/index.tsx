import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { Select, Space } from 'antd'
import { useAuthStore } from '@/store/auth'

interface TerminalProps {
  namespace: string
  podName: string
  containers: string[]
  height?: number
}

export default function Terminal({ namespace, podName, containers, height = 400 }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [container, setContainer] = React.useState(containers[0] ?? '')
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!termRef.current) return

    const term = new XTerm({
      theme: {
        background: '#0d0d0d',
        foreground: '#d4d4d4',
        cursor: '#1677ff',
        selectionBackground: 'rgba(22,119,255,0.3)',
        black: '#1a1a1a',
        brightBlack: '#555',
        red: '#f85149',
        brightRed: '#f97583',
        green: '#56d364',
        brightGreen: '#85e89d',
        yellow: '#e3b341',
        brightYellow: '#f0c674',
        blue: '#1677ff',
        brightBlue: '#79b8ff',
        magenta: '#bc8cff',
        brightMagenta: '#d2a8ff',
        cyan: '#39c5cf',
        brightCyan: '#87c9cc',
        white: '#cdd9e5',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fit = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(termRef.current)
    fit.fit()

    xtermRef.current = term
    fitRef.current = fit

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = new URL(`${protocol}//${host}/api/pods/${namespace}/${podName}/exec`)
    url.searchParams.set('container', container)
    url.searchParams.set('command', '/bin/sh')
    if (token) url.searchParams.set('token', token)

    const ws = new WebSocket(url.toString())
    wsRef.current = ws

    ws.onopen = () => {
      term.write('\r\n\x1b[32m[KubeVision] Connected to ' + podName + '/' + container + '\x1b[0m\r\n')
      fit.fit()
    }

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        term.write(e.data)
      } else {
        const reader = new FileReader()
        reader.onload = () => term.write(reader.result as string)
        reader.readAsText(e.data)
      }
    }

    ws.onclose = () => {
      term.write('\r\n\x1b[31m[KubeVision] Connection closed\x1b[0m\r\n')
    }

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[KubeVision] Connection error\x1b[0m\r\n')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    const observer = new ResizeObserver(() => fit.fit())
    observer.observe(termRef.current)

    return () => {
      observer.disconnect()
      ws.close()
      term.dispose()
    }
  }, [container, namespace, podName])

  return (
    <div className="terminal-container">
      <div style={{
        padding: '8px 12px',
        background: '#161b22',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ color: '#8b949e', fontSize: 12 }}>Shell:</span>
        <Select
          value={container}
          onChange={(v) => setContainer(v)}
          options={containers.map((c) => ({ value: c, label: c }))}
          size="small"
          style={{ width: 150 }}
        />
        <span style={{ color: '#52c41a', fontSize: 12 }}>● Interactive Terminal</span>
      </div>
      <div
        ref={termRef}
        style={{ height, padding: 8 }}
      />
    </div>
  )
}
