import React from 'react'
import Editor from '@monaco-editor/react'
import { Button, Space, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { copyToClipboard } from '@/utils'

interface YamlEditorProps {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  height?: number | string
  showCopy?: boolean
}

export default function YamlEditor({
  value,
  onChange,
  readOnly = false,
  height = 400,
  showCopy = true,
}: YamlEditorProps) {
  return (
    <div className="monaco-editor-container">
      {showCopy && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '4px 8px',
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
        }}>
          <Space>
            <Button
              size="small"
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(value).then(() => message.success('Copied YAML'))}
            >
              Copy
            </Button>
          </Space>
        </div>
      )}
      <Editor
        height={height}
        language="yaml"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          formatOnPaste: true,
          tabSize: 2,
          renderWhitespace: 'boundary',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
        }}
      />
    </div>
  )
}
