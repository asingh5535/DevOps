import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function TweetCard({ tweet, onDelete, onUpdate }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')

  const t = tweet

  const like = async () => {
    if (t.liked) {
      await api.delete(`/tweets/${t.id}/like`)
    } else {
      await api.post(`/tweets/${t.id}/like`)
    }
    onUpdate?.({ ...t, liked: !t.liked, likes_count: t.likes_count + (t.liked ? -1 : 1) })
  }

  const retweet = async () => {
    if (t.retweeted) {
      await api.delete(`/tweets/${t.id}/retweet`)
    } else {
      await api.post(`/tweets/${t.id}/retweet`)
    }
    onUpdate?.({ ...t, retweeted: !t.retweeted, retweets_count: t.retweets_count + (t.retweeted ? -1 : 1) })
  }

  const bookmark = async () => {
    if (t.bookmarked) {
      await api.delete(`/tweets/${t.id}/bookmark`)
    } else {
      await api.post(`/tweets/${t.id}/bookmark`)
    }
    onUpdate?.({ ...t, bookmarked: !t.bookmarked })
  }

  const submitReply = async e => {
    e.preventDefault()
    if (!replyText.trim()) return
    await api.post('/tweets', { content: replyText, reply_to: t.id })
    setReplyText('')
    setShowReply(false)
    onUpdate?.({ ...t, replies_count: (t.replies_count || 0) + 1 })
  }

  const del = async () => {
    if (!confirm('Delete this tweet?')) return
    await api.delete(`/tweets/${t.id}`)
    onDelete?.(t.id)
  }

  const fmt = d => {
    const diff = Date.now() - new Date(d)
    const s = Math.floor(diff / 1000)
    if (s < 60)  return `${s}s`
    if (s < 3600) return `${Math.floor(s/60)}m`
    if (s < 86400) return `${Math.floor(s/3600)}h`
    return new Date(d).toLocaleDateString()
  }

  return (
    <div className="tweet-card">
      {t.retweet_by && (
        <div className="retweet-label">🔁 {t.retweet_by} retweeted</div>
      )}
      {t.reply_to && (
        <div className="retweet-label">↩ Reply</div>
      )}

      <div className="tweet-main">
        <img
          src={t.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.handle}`}
          className="avatar"
          alt=""
          onClick={() => navigate(`/${t.handle}`)}
        />
        <div className="tweet-body">
          <div className="tweet-header">
            <span className="tweet-author" onClick={() => navigate(`/${t.handle}`)}>
              {t.username}
              {t.verified && <span className="verified-badge">✓</span>}
            </span>
            <span className="tweet-handle" onClick={() => navigate(`/${t.handle}`)}>@{t.handle}</span>
            <span className="tweet-time">· {fmt(t.created_at)}</span>
            {user?.id === t.user_id && (
              <button className="delete-btn" onClick={del} title="Delete">✕</button>
            )}
          </div>

          <div className="tweet-content">
            {t.content?.split(/(\s+)/).map((word, i) =>
              word.startsWith('#')
                ? <span key={i} className="hashtag" onClick={() => navigate(`/explore?q=${word.slice(1)}`)}>{word}</span>
                : word.startsWith('@')
                ? <span key={i} className="mention" onClick={() => navigate(`/${word.slice(1)}`)}>{word}</span>
                : word
            )}
          </div>

          {t.image_url && <img src={t.image_url} className="tweet-image" alt="" />}

          <div className="tweet-actions">
            <button className="action-btn reply-btn" onClick={() => setShowReply(!showReply)}>
              💬 <span>{t.replies_count || 0}</span>
            </button>
            <button className={`action-btn retweet-btn${t.retweeted ? ' active' : ''}`} onClick={retweet}>
              🔁 <span>{t.retweets_count || 0}</span>
            </button>
            <button className={`action-btn like-btn${t.liked ? ' active' : ''}`} onClick={like}>
              {t.liked ? '❤️' : '🤍'} <span>{t.likes_count || 0}</span>
            </button>
            <button className={`action-btn bookmark-btn${t.bookmarked ? ' active' : ''}`} onClick={bookmark}>
              {t.bookmarked ? '🔖' : '📎'}
            </button>
          </div>

          {showReply && (
            <form className="reply-form" onSubmit={submitReply}>
              <textarea
                className="reply-input"
                placeholder="Tweet your reply"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                maxLength={280}
              />
              <button className="reply-submit" type="submit" disabled={!replyText.trim()}>Reply</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
