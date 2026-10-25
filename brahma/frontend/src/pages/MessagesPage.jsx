import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function MessagesPage() {
  const { userId }  = useParams()
  const { user: me } = useAuth()
  const navigate    = useNavigate()

  const [convos, setConvos]     = useState([])
  const [messages, setMessages] = useState([])
  const [activeUser, setActive] = useState(null)
  const [text, setText]         = useState('')
  const [loading, setLoad]      = useState(false)
  const [newHandle, setNewHandle] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    api.get('/messages/conversations')
      .then(r => setConvos(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (userId) {
      api.get(`/users/id/${userId}`).then(r => openConvo(r.data)).catch(() => {})
    }
  }, [userId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openConvo = async (u) => {
    setActive(u)
    setLoad(true)
    try {
      const { data } = await api.get(`/messages/${u.id}`)
      setMessages(data)
    } finally {
      setLoad(false)
    }
  }

  const send = async e => {
    e.preventDefault()
    if (!text.trim() || !activeUser) return
    const { data } = await api.post(`/messages/${activeUser.id}`, { content: text.trim() })
    setMessages(m => [...m, data])
    setText('')

    setConvos(c => {
      const existing = c.find(x => x.other_user === activeUser.id)
      if (existing) {
        return c.map(x => x.other_user === activeUser.id
          ? { ...x, last_message: data.content, created_at: data.created_at }
          : x)
      }
      return [{ other_user: activeUser.id, username: activeUser.username, handle: activeUser.handle,
                avatar_url: activeUser.avatar_url, last_message: data.content, created_at: data.created_at }, ...c]
    })
  }

  const startNew = async e => {
    e.preventDefault()
    if (!newHandle.trim()) return
    try {
      const { data } = await api.get(`/users/${newHandle.trim()}`)
      openConvo(data)
      navigate(`/messages/${data.id}`)
      setNewHandle('')
    } catch {
      alert('User not found')
    }
  }

  const fmt = d => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s/60)}m`
    if (s < 86400) return `${Math.floor(s/3600)}h`
    return new Date(d).toLocaleDateString()
  }

  return (
    <div className="messages-layout">
      <div className="convo-list">
        <div className="page-header"><h2 className="page-title">Messages</h2></div>

        <form onSubmit={startNew} className="new-msg-form">
          <input
            className="search-input"
            placeholder="Start new chat (handle)"
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
          />
        </form>

        {convos.length === 0 && <div className="empty-msg small">No conversations yet.</div>}

        {convos.map(c => (
          <div
            key={c.other_user}
            className={`convo-item${activeUser?.id === c.other_user ? ' active' : ''}`}
            onClick={() => { openConvo({ id: c.other_user, username: c.username, handle: c.handle, avatar_url: c.avatar_url }); navigate(`/messages/${c.other_user}`) }}
          >
            <img
              src={c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.handle}`}
              className="avatar-sm"
              alt=""
            />
            <div className="convo-info">
              <div className="convo-name">{c.username}</div>
              <div className="convo-preview">{c.last_message}</div>
            </div>
            <div className="convo-time">{fmt(c.created_at)}</div>
          </div>
        ))}
      </div>

      <div className="chat-panel">
        {!activeUser ? (
          <div className="chat-empty">Select a conversation or search for a user to start messaging</div>
        ) : (
          <>
            <div className="chat-header">
              <img
                src={activeUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.handle}`}
                className="avatar-sm"
                alt=""
              />
              <div>
                <div className="fw-bold">{activeUser.username}</div>
                <div className="text-dim">@{activeUser.handle}</div>
              </div>
            </div>

            <div className="chat-messages">
              {loading && <div className="loading-msg">Loading…</div>}
              {messages.map(m => (
                <div key={m.id} className={`msg-bubble${m.sender_id === me?.id ? ' mine' : ''}`}>
                  <div className="msg-text">{m.content}</div>
                  <div className="msg-time">{fmt(m.created_at)}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <form className="chat-input-form" onSubmit={send}>
              <input
                className="chat-input"
                placeholder="Start a new message"
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <button className="send-btn" type="submit" disabled={!text.trim()}>Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
