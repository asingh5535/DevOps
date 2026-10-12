import { useEffect, useRef, useState } from 'react'

interface Props {
  busy: boolean
  disabled: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function Composer({ busy, disabled, onSend, onStop }: Props) {
  const [text, setText] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)

  // Grow with the text, up to a limit.
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text])

  const send = () => {
    if (!text.trim() || busy || disabled) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={box}
          className="composer-input"
          rows={1}
          value={text}
          placeholder={disabled ? 'Choose a model to start' : 'Message Vachi'}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          aria-label="Message"
        />
        {busy ? (
          <button type="button" className="button stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="button" className="button primary" onClick={send} disabled={!text.trim() || disabled}>
            Send
          </button>
        )}
      </div>
      <p className="composer-hint muted small">Enter to send · Shift+Enter for a new line · AI can make mistakes</p>
    </div>
  )
}
