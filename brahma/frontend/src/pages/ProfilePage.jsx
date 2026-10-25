import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TweetCard from '../components/TweetCard'
import api from '../api'

export default function ProfilePage() {
  const { handle }  = useParams()
  const { user: me, updateUser } = useAuth()
  const navigate    = useNavigate()

  const [profile, setProfile]       = useState(null)
  const [tweets, setTweets]         = useState([])
  const [following, setFollowing]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState(false)
  const [bio, setBio]               = useState('')
  const [tab, setTab]               = useState('tweets')

  const isMe = me?.handle === handle

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/users/${handle}`),
      api.get(`/users/${handle}/tweets`),
    ]).then(([p, t]) => {
      setProfile(p.data)
      setTweets(t.data)
      setBio(p.data.bio || '')
      if (!isMe) {
        api.get(`/users/${p.data.id}/is-following`)
          .then(r => setFollowing(r.data.following))
          .catch(() => {})
      }
    }).catch(() => navigate('/'))
    .finally(() => setLoading(false))
  }, [handle, isMe])

  const toggleFollow = async () => {
    if (following) {
      await api.delete(`/users/${profile.id}/follow`)
      setFollowing(false)
      setProfile(p => ({ ...p, followers_count: (p.followers_count || 1) - 1 }))
    } else {
      await api.post(`/users/${profile.id}/follow`)
      setFollowing(true)
      setProfile(p => ({ ...p, followers_count: (p.followers_count || 0) + 1 }))
    }
  }

  const saveProfile = async () => {
    const { data } = await api.patch('/users/me', { bio })
    updateUser({ ...me, bio: data.bio })
    setProfile(p => ({ ...p, bio: data.bio }))
    setEditing(false)
  }

  const onDelete = id => setTweets(prev => prev.filter(t => t.id !== id))
  const onUpdate = u => setTweets(prev => prev.map(t => t.id === u.id ? u : t))

  if (loading) return <div className="loading-msg">Loading profile…</div>
  if (!profile) return null

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="page-title">{profile.username}</h2>
      </div>

      <div className="profile-banner" />

      <div className="profile-top">
        <img
          src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.handle}`}
          className="profile-avatar"
          alt=""
        />
        <div className="profile-actions">
          {isMe ? (
            editing ? (
              <div className="edit-profile-form">
                <textarea
                  className="bio-input"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Your bio"
                  maxLength={160}
                />
                <button className="save-btn" onClick={saveProfile}>Save</button>
                <button className="cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            ) : (
              <button className="edit-profile-btn" onClick={() => setEditing(true)}>Edit profile</button>
            )
          ) : (
            <div className="profile-btns">
              <button className="msg-btn" onClick={() => navigate(`/messages/${profile.id}`)}>Message</button>
              <button className={`follow-btn${following ? ' following' : ''}`} onClick={toggleFollow}>
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="profile-info">
        <h2 className="profile-name">
          {profile.username}
          {profile.verified && <span className="verified-badge">✓</span>}
        </h2>
        <div className="profile-handle">@{profile.handle}</div>
        {profile.bio && <div className="profile-bio">{profile.bio}</div>}
        <div className="profile-stats">
          <span onClick={() => navigate(`/${handle}/following`)}><strong>{profile.following_count || 0}</strong> Following</span>
          <span onClick={() => navigate(`/${handle}/followers`)}><strong>{profile.followers_count || 0}</strong> Followers</span>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab${tab === 'tweets' ? ' active' : ''}`} onClick={() => setTab('tweets')}>Tweets</button>
      </div>

      {tweets.length === 0 && <div className="empty-msg">No tweets yet.</div>}
      {tweets.map(t => (
        <TweetCard key={t.id} tweet={t} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  )
}
