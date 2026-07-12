'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const mockConversations = [
  { id: '1', name: 'Jane Doe', lastMessage: 'See you tomorrow!' },
  { id: '2', name: 'John Smith', lastMessage: 'Sounds good 👍' },
  { id: '3', name: 'Amaka Obi', lastMessage: 'Let me check and get back' },
]

type Message = { id: string; sender: 'me' | 'them'; content: string; time: string }

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    { id: 'a', sender: 'them', content: 'Hey, how are you?', time: '10:02 AM' },
    { id: 'b', sender: 'me', content: "I'm good! Working on the app right now.", time: '10:03 AM' },
    { id: 'c', sender: 'them', content: "Nice, can't wait to try it.", time: '10:04 AM' },
  ])
  const [draft, setDraft] = useState('')

  const filteredConversations = mockConversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const selectedConversation = mockConversations.find((c) => c.id === selectedId)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSend = () => {
    if (!draft.trim()) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: 'me', content: draft.trim(), time: now },
    ])
    setDraft('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar: conversation list */}
      {/* On mobile: hidden once a chat is selected. On desktop: always visible. */}
      <div
        className="chat-sidebar"
        style={{
          width: 320,
          borderRight: '1px solid #e0e0e0',
          display: selectedId ? 'none' : 'flex',
          flexDirection: 'column',
          background: '#fff',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#075E54', color: '#fff' }}>
          <strong>Elite-Elator</strong>
          <button onClick={handleLogout} style={{ fontSize: 12, background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: 6, padding: '4px 8px' }}>
            Log out
          </button>
        </div>
        <div style={{ padding: 12, borderBottom: '1px solid #e0e0e0' }}>
          <input
            type="text"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 20, background: '#f0f2f5' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 && (
            <div style={{ padding: 12, color: '#999', fontSize: 13 }}>No matches found</div>
          )}
          {filteredConversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                padding: 12,
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ccc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                {c.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: '#666' }}>{c.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main: chat window */}
      {/* On mobile: only shown once a conversation is selected. On desktop: always visible. */}
      <div
        className="chat-main"
        style={{
          flex: 1,
          display: selectedId ? 'flex' : 'none',
          flexDirection: 'column',
          backgroundImage: 'url(/chat-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {selectedConversation ? (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', background: '#075E54', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Back button — only meaningful/visible on mobile via CSS below */}
              <button
                className="back-button"
                onClick={() => setSelectedId(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'none' }}
              >
                ←
              </button>
              <strong>{selectedConversation.name}</strong>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.85)' }}>
              {messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.sender === 'me' ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
                  <div
                    style={{
                      background: m.sender === 'me' ? '#DCF8C6' : '#fff',
                      color: '#000',
                      padding: '8px 12px',
                      borderRadius: 8,
                      boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                    }}
                  >
                    {m.content}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2, textAlign: m.sender === 'me' ? 'right' : 'left' }}>
                    {m.time}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8, background: '#f0f2f5' }}>
              <input
                type="text"
                placeholder="Type a message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                style={{ flex: 1, padding: 10, border: 'none', borderRadius: 20 }}
              />
              <button onClick={handleSend} style={{ padding: '8px 16px', background: '#075E54', color: '#fff', border: 'none', borderRadius: 20 }}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', background: 'rgba(255,255,255,0.85)' }}>
            Select a conversation to start chatting
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .chat-sidebar { display: flex !important; }
          .chat-main { display: flex !important; }
          .back-button { display: none !important; }
        }
        @media (max-width: 767px) {
          .back-button { display: inline-block !important; }
        }
      `}</style>
    </div>
  )
}