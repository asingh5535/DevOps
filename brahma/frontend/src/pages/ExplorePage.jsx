import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import TweetCard from '../components/TweetCard'
import api from '../api'

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery]   = useState(searchParams.get('q') || '')
  const [results, setRes]   = useState([])
  const [loading, setLoad]  = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); doSearch(q) }
  }, [searchParams])

  const doSearch = async (q = query) => {
    if (!q?.trim()) return
    setLoad(true)
    setSearched(true)
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q.trim())}`)
      setRes(data)
    } catch {
      setRes([])
    } finally {
      setLoad(false)
    }
  }

  const submit = e => {
    e.preventDefault()
    setSearchParams(query ? { q: query } : {})
    doSearch()
  }

  const onUpdate = updated => setRes(prev => prev.map(t => t.id === updated.id ? updated : t))
  const onDelete = id => setRes(prev => prev.filter(t => t.id !== id))

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Explore</h2>
      </div>

      <div className="explore-search">
        <form onSubmit={submit}>
          <input
            className="search-input large"
            placeholder="Search tweets, people, hashtags…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="search-btn" type="submit">Search</button>
        </form>
      </div>

      {loading && <div className="loading-msg">Searching…</div>}

      {!loading && searched && results.length === 0 && (
        <div className="empty-msg">No results for "{query}"</div>
      )}

      {results.map(t => (
        <TweetCard key={t.id} tweet={t} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  )
}
