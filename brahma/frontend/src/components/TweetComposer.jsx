import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function TweetComposer({ onTweet, replyTo = null }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef(null)

  const remaining = 280 - text.length

  const submit = async e => {
    e?.preventDefault()
    if (!text.trim() || posting) return
    setPosting(true)
    try {
      const payload = { content: text.trim() }
      if (replyTo) payload.reply_to = replyTo
      const { data } = await api.post('/tweets', payload)
      setText('')
      onTweet?.(data)
    } catch {
      alert('Failed to post tweet')
    } finally {
      setPosting(false)
    }
  }

  const handleKey = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
  }

  return (
    <div className="composer">
      <img
        src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.handle}`}
        className="avatar"
        alt=""
      />
      <div className="composer-body">
        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder={replyTo ? 'Tweet your reply…' : "What's happening?"}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          maxLength={280}
          rows={3}
        />
        <div className="composer-footer">
          <span className={`char-count${remaining < 20 ? ' warn' : ''}`}>{remaining}</span>
          <button
            className="post-btn"
            onClick={submit}
            disabled={!text.trim() || posting || remaining < 0}
          >
            {posting ? '…' : 'Tweet'}
          </button>
        </div>
      </div>
    </div>
  )
}
