import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const ICONS = { like: '❤️', retweet: '🔁', follow: '👤', reply: '💬', mention: '@' }

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoad]  = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/notifications')
      .then(r => setNotifs(r.data))
      .catch(() => {})
      .finally(() => setLoad(false))
  }, [])

  const markRead = async id => {
    await api.put(`/notifications/${id}/read`).catch(() => {})
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  }

  const fmt = d => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s/60)}m`
    if (s < 86400) return `${Math.floor(s/3600)}h`
    return new Date(d).toLocaleDateString()
  }

  return (
    <div>
      <div className="page-header"><h2 className="page-title">Notifications</h2></div>

      {loading && <div className="loading-msg">Loading…</div>}

      {!loading && notifs.length === 0 && (
        <div className="empty-msg">No notifications yet.</div>
      )}

      {notifs.map(n => (
        <div
          key={n.id}
          className={`notif-item${n.read ? '' : ' unread'}`}
          onClick={() => { markRead(n.id); if (n.tweet_id) navigate(`/`); else navigate(`/${n.actor_handle}`) }}
        >
          <span className="notif-icon">{ICONS[n.type] || '🔔'}</span>
          <div className="notif-body">
            <img
              src={n.actor_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${n.actor_handle}`}
              className="avatar-sm"
              alt=""
            />
            <div className="notif-text">
              <strong>{n.actor_username}</strong>{' '}
              {n.type === 'like'    && 'liked your tweet'}
              {n.type === 'retweet' && 'retweeted your tweet'}
              {n.type === 'follow'  && 'followed you'}
              {n.type === 'reply'   && 'replied to your tweet'}
              {n.type === 'mention' && 'mentioned you'}
              {n.tweet_preview && <div className="notif-preview">{n.tweet_preview}</div>}
            </div>
            <span className="notif-time">{fmt(n.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
