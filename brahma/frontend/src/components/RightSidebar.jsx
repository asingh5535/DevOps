import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function RightSidebar() {
  const [trends, setTrends]       = useState([])
  const [suggestions, setSugg]    = useState([])
  const [search, setSearch]       = useState('')
  const [results, setResults]     = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/trending').then(r => setTrends(r.data)).catch(() => {})
    api.get('/users/suggestions/who-to-follow').then(r => setSugg(r.data)).catch(() => {})
  }, [])

  const doSearch = async e => {
    e.preventDefault()
    if (!search.trim()) return
    const r = await api.get(`/search?q=${encodeURIComponent(search)}`)
    setResults(r.data)
  }

  const follow = async (id) => {
    await api.post(`/users/${id}/follow`)
    setSugg(s => s.filter(u => u.id !== id))
  }

  return (
    <aside className="right-sidebar">
      <form onSubmit={doSearch} className="search-form">
        <input
          className="search-input"
          placeholder="Search Brahma"
          value={search}
          onChange={e => { setSearch(e.target.value); if (!e.target.value) setResults(null) }}
        />
      </form>

      {results && (
        <div className="search-results">
          <h3 className="sidebar-title">Results</h3>
          {results.length === 0 && <p className="empty-msg">No results found.</p>}
          {results.map(t => (
            <div key={t.id} className="search-result-item" onClick={() => { setResults(null); setSearch('') }}>
              <img src={t.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.handle}`} className="avatar-sm" alt="" />
              <div>
                <div className="fw-bold">{t.username}</div>
                <div className="text-dim">{t.content?.slice(0, 60)}…</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {trends.length > 0 && (
        <div className="trends-box">
          <h3 className="sidebar-title">Trends for you</h3>
          {trends.map(t => (
            <div key={t.tag} className="trend-item" onClick={() => navigate(`/explore?q=${t.tag}`)}>
              <div className="trend-tag">#{t.tag}</div>
              <div className="trend-count">{t.count} tweets</div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="who-to-follow">
          <h3 className="sidebar-title">Who to follow</h3>
          {suggestions.map(u => (
            <div key={u.id} className="suggestion-item">
              <img
                src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.handle}`}
                className="avatar-sm"
                alt=""
                onClick={() => navigate(`/${u.handle}`)}
              />
              <div className="suggestion-info" onClick={() => navigate(`/${u.handle}`)}>
                <span className="fw-bold">{u.username}</span>
                <span className="text-dim">@{u.handle}</span>
              </div>
              <button className="follow-btn" onClick={() => follow(u.id)}>Follow</button>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
