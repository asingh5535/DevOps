import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../api'
import { Markdown } from './Markdown'

export interface StreamingState {
  text: string
  notices: string[]
  model: string | null
}

interface Props {
  messages: ChatMessage[]
  streaming: StreamingState | null
  busy: boolean
  error: string | null
  onEdit: (message: ChatMessage, content: string) => void
  onRegenerate: () => void
  onSuggestion: (text: string) => void
}

const SUGGESTIONS = [
  'Explain Docker volumes vs bind mounts with examples',
  'My Kubernetes pod is in CrashLoopBackOff. How do I debug it?',
  'Nginx reverse proxy config for a Flask app, please',
  'Docker aur virtual machine mein kya fark hai?',
]

export function Messages({ messages, streaming, busy, error, onEdit, onRegenerate, onSuggestion }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, streaming?.text, error])

  const onScroll = () => {
    const el = scroller.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  if (messages.length === 0 && !streaming) {
    return (
      <div className="messages empty">
        <div className="welcome">
          <h1>How can I help?</h1>
          <p className="muted">Ask in English, Hindi or Hinglish.</p>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button type="button" key={s} className="suggestion" onClick={() => onSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const lastIsUser = messages.at(-1)?.role === 'user'

  return (
    <div className="messages" ref={scroller} onScroll={onScroll}>
      <div className="messages-inner">
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            busy={busy}
            canRegenerate={m.id === lastAssistant?.id && messages.at(-1)?.id === m.id}
            onEdit={(content) => onEdit(m, content)}
            onRegenerate={onRegenerate}
          />
        ))}
        {streaming && (
          <div className="message assistant">
            <div className="message-meta">{streaming.model}</div>
            {streaming.text ? <Markdown text={streaming.text} /> : <TypingDots />}
            {streaming.notices.map((n, i) => (
              <p key={i} className="notice">
                {n}
              </p>
            ))}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            {lastIsUser && !busy && (
              <button type="button" className="button ghost" onClick={onRegenerate}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageItem({
  message,
  busy,
  canRegenerate,
  onEdit,
  onRegenerate,
}: {
  message: ChatMessage
  busy: boolean
  canRegenerate: boolean
  onEdit: (content: string) => void
  onRegenerate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  if (message.role === 'user') {
    if (editing) {
      return (
        <div className="message user editing">
          <textarea
            className="input edit-box"
            value={draft}
            autoFocus
            rows={Math.min(10, draft.split('\n').length + 1)}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit message"
          />
          <div className="message-actions visible">
            <button type="button" className="button ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="button primary"
              disabled={!draft.trim() || busy}
              onClick={() => {
                setEditing(false)
                onEdit(draft.trim())
              }}
            >
              Save & send
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="message user">
        <div className="bubble">{message.content}</div>
        <div className="message-actions">
          <button type="button" className="link-button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => {
              setDraft(message.content)
              setEditing(true)
            }}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="message assistant">
      <div className="message-meta">
        {message.model}
        {message.stop_reason === 'stopped' && <span className="tag">stopped</span>}
        {message.stop_reason === 'error' && <span className="tag danger">incomplete</span>}
      </div>
      <Markdown text={message.content} />
      <div className="message-actions">
        <button type="button" className="link-button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {canRegenerate && (
          <button type="button" className="link-button" disabled={busy} onClick={onRegenerate}>
            Regenerate
          </button>
        )}
        {message.output_tokens != null && (
          <span className="muted small">
            {message.input_tokens} in · {message.output_tokens} out
          </span>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="typing" aria-label="Vachi is writing">
      <span />
      <span />
      <span />
    </div>
  )
}
