import { useState, useEffect } from 'react'
import TweetCard from '../components/TweetCard'
import api from '../api'

export default function BookmarksPage() {
  const [tweets, setTweets] = useState([])
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    api.get('/tweets/user/bookmarks')
      .then(r => setTweets(r.data))
      .catch(() => {})
      .finally(() => setLoad(false))
  }, [])

  const onDelete = id => setTweets(p => p.filter(t => t.id !== id))
  const onUpdate = u => {
    if (!u.bookmarked) setTweets(p => p.filter(t => t.id !== u.id))
    else setTweets(p => p.map(t => t.id === u.id ? u : t))
  }

  return (
    <div>
      <div className="page-header"><h2 className="page-title">Bookmarks</h2></div>

      {loading && <div className="loading-msg">Loading…</div>}

      {!loading && tweets.length === 0 && (
        <div className="empty-msg">No bookmarks yet. Save tweets to read later.</div>
      )}

      {tweets.map(t => (
        <TweetCard key={t.id} tweet={t} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  )
}
