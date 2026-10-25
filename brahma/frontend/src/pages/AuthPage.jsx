import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function AuthPage() {
  const [mode, setMode]       = useState('login')
  const [form, setForm]       = useState({ username: '', handle: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url  = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { username: form.username, handle: form.handle, email: form.email, password: form.password }
      const { data } = await api.post(url, body)
      login(data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">𝕭</div>
      <div className="auth-card">
        <h1>{mode === 'login' ? 'Sign in to Brahma' : 'Join Brahma today'}</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <>
              <input
                className="auth-input"
                placeholder="Full name"
                value={form.username}
                onChange={set('username')}
                required
              />
              <input
                className="auth-input"
                placeholder="Handle (no @)"
                value={form.handle}
                onChange={set('handle')}
                pattern="[a-zA-Z0-9_]+"
                required
              />
            </>
          )}
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={set('email')}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={6}
          />
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <span>New to Brahma? <button onClick={() => setMode('register')}>Create account</button></span>
          ) : (
            <span>Already have an account? <button onClick={() => setMode('login')}>Sign in</button></span>
          )}
        </div>

        {mode === 'login' && (
          <div className="auth-demo">
            <strong>Demo accounts:</strong> abhishek@demo.com / brahma123 &nbsp;|&nbsp; priya@demo.com / brahma123
          </div>
        )}
      </div>
    </div>
  )
}
