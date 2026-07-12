'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const mockConversations = [
  { id: '1', name: 'Jane Doe', lastMessage: 'See you tomorrow!' },
  { id: '2', name: 'John Smith', lastMessage: 'Sounds good 👍' },
]

type Message = { id: string; sender: 'me' | 'them'; content: string }

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()

  const [messages, setMessages] = useState<Message[]>([
    { id: 'a', sender: 'them', content: 'Hey, how are you?' },
    { id: 'b', sender: 'me', content: 'I\'m good! Working on the app right now.' },
    { id: 'c', sender: 'them', content: 'Nice, can\'t wait to try it.' },
  ])
  const [draft, setDraft] = useState('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSend = () => {
    if (!draft.trim()) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: 'me', content: draft.trim() },
    ])
    setDraft('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 280, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Chats</strong>
          <button onClick={handleLogout} style={{ fontSize: 12 }}>Log out</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {mockConversations.map((c) => (
            <div key={c.id} style={{ padding: 12, borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{c.lastMessage}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0' }}>
          <strong>Jane Doe</strong>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === 'me' ? 'flex-end' : 'flex-start',
                background: m.sender === 'me' ? '#0070f3' : '#f0f0f0',
                color: m.sender === 'me' ? '#fff' : '#000',
                padding: '8px 12px',
                borderRadius: 12,
                maxWidth: '60%',
              }}
            >
              {m.content}
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
          />
          <button onClick={handleSend} style={{ padding: '8px 16px' }}>Send</button>
        </div>
      </div>
    </div>
  )
}