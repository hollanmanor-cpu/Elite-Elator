'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/chat')
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    border: '1px solid #ccc',
    color: '#000000',
    backgroundColor: '#ffffff',
    fontSize: 15,
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24, background: 'rgba(255,255,255,0.92)', borderRadius: 12 }}>
      <h1 style={{ color: '#000', marginBottom: 16 }}>Log in</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: 10, width: '100%', background: '#075E54', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p style={{ marginTop: 12, color: '#000' }}>Don&apos;t have an account? <a href="/register" style={{ color: '#075E54' }}>Register</a></p>
    </div>
  )
}