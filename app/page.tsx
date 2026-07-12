import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center',
      padding: 20,
    }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Elite-Elator</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>Private, real-time messaging.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/login" style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
          Log in
        </Link>
        <Link href="/register" style={{ padding: '10px 20px', border: '1px solid #0070f3', color: '#0070f3', borderRadius: 8, textDecoration: 'none' }}>
          Register
        </Link>
      </div>
    </div>
  )
}