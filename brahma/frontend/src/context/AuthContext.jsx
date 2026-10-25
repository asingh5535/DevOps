import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => JSON.parse(localStorage.getItem('brahma_user') || 'null'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('brahma_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(r => { setUser(r.data); localStorage.setItem('brahma_user', JSON.stringify(r.data)) })
      .catch(() => { localStorage.removeItem('brahma_token'); localStorage.removeItem('brahma_user'); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = ({ token, user }) => {
    localStorage.setItem('brahma_token', token)
    localStorage.setItem('brahma_user', JSON.stringify(user))
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('brahma_token')
    localStorage.removeItem('brahma_user')
    setUser(null)
  }

  const updateUser = (u) => {
    setUser(u)
    localStorage.setItem('brahma_user', JSON.stringify(u))
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
