import { useState, useEffect, useCallback } from 'react'
import TweetComposer from '../components/TweetComposer'
import TweetCard from '../components/TweetCard'
import api from '../api'

export default function HomePage() {
  const [tweets, setTweets] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('for-you')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/tweets/timeline')
      setTweets(data)
    } catch {
      setTweets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onTweet = t => setTweets(prev => [t, ...prev])

  const onDelete = id => setTweets(prev => prev.filter(t => t.id !== id))

  const onUpdate = updated =>
    setTweets(prev => prev.map(t => t.id === updated.id ? updated : t))

  return (
    <div>
      <div className="page-header">
        <div className="tab-bar">
          <button className={`tab${tab === 'for-you' ? ' active' : ''}`} onClick={() => setTab('for-you')}>
            For you
          </button>
          <button className={`tab${tab === 'following' ? ' active' : ''}`} onClick={() => setTab('following')}>
            Following
          </button>
        </div>
      </div>

      <TweetComposer onTweet={onTweet} />

      <div className="divider" />

      {loading && <div className="loading-msg">Loading tweets…</div>}

      {!loading && tweets.length === 0 && (
        <div className="empty-msg">
          <p>No tweets yet.</p>
          <p>Follow some people or post your first tweet!</p>
        </div>
      )}

      {tweets.map(t => (
        <TweetCard key={t.id} tweet={t} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  )
}
