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
      <h1 style={{ fontSize: 36, marginBottom: 8, color: '#fff' }}>Elite-Elator</h1>
      <p style={{ color: '#ccc', marginBottom: 24 }}>Private, real-time messaging.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/login" style={{ padding: '10px 20px', background: '#075E54', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
          Log in
        </Link>
        <Link href="/register" style={{ padding: '10px 20px', border: '1px solid #075E54', background: '#fff', color: '#075E54', borderRadius: 8, textDecoration: 'none' }}>
          Register
        </Link>
      </div>
    </div>
  )
}