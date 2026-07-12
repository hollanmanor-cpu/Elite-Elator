'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Conversation = { id: string; name: string; lastMessage: string; otherUserId: string }
type Message = { id: string; sender_id: string; content: string; created_at: string }
type SearchResult = { id: string; username: string; email: string }

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loadingConvos, setLoadingConvos] = useState(true)

  const [showNewChat, setShowNewChat] = useState(false)
  const [emailQuery, setEmailQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Get current logged-in user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // Load the conversation list for the sidebar
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return
    setLoadingConvos(true)

    const { data: myRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    const convoIds = (myRows ?? []).map((r) => r.conversation_id)
    if (convoIds.length === 0) {
      setConversations([])
      setLoadingConvos(false)
      return
    }

    const { data: otherRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles(username)')
      .in('conversation_id', convoIds)
      .neq('user_id', currentUserId)

    const result: Conversation[] = []
    for (const row of otherRows ?? []) {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', row.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      result.push({
        id: row.conversation_id,
        otherUserId: row.user_id,
        // @ts-expect-error profiles is joined as an object
        name: row.profiles?.username ?? 'Unknown',
        lastMessage: lastMsg?.content ?? 'Say hello 👋',
      })
    }

    setConversations(result)
    setLoadingConvos(false)
  }, [currentUserId])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load messages for the selected conversation + subscribe to realtime updates
  useEffect(() => {
    if (!selectedId) return

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true })
      setMessages(data ?? [])
    }
    loadMessages()

    const channel = supabase
      .channel(`messages-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedId])

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSend = async () => {
    if (!draft.trim() || !selectedId || !currentUserId) return
    const content = draft.trim()
    setDraft('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedId,
      sender_id: currentUserId,
      content,
    })

    if (error) {
      console.error('Send failed:', error.message)
    }
  }

  const handleSearchUser = async () => {
    if (!emailQuery.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email')
      .ilike('email', `%${emailQuery.trim()}%`)
      .neq('id', currentUserId)
      .limit(10)

    setSearching(false)

    if (error) {
      setSearchError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setSearchError('No user found with that email.')
      return
    }
    setSearchResults(data)
  }

  const handleStartChat = async (user: SearchResult) => {
    if (!currentUserId) return

    const existing = conversations.find((c) => c.otherUserId === user.id)
    if (existing) {
      setSelectedId(existing.id)
      setSelectedName(existing.name)
      setShowNewChat(false)
      setEmailQuery('')
      setSearchResults([])
      return
    }

    const { data: newConvo, error: convoError } = await supabase
      .from('conversations')
      .insert({ created_by: currentUserId })
      .select()
      .single()

    if (convoError || !newConvo) {
      setSearchError(convoError?.message || 'Could not start conversation.')
      return
    }

    const { error: participantsError } = await supabase.from('conversation_participants').insert([
      { conversation_id: newConvo.id, user_id: currentUserId },
      { conversation_id: newConvo.id, user_id: user.id },
    ])

    if (participantsError) {
      setSearchError(participantsError.message)
      return
    }

    await loadConversations()
    setSelectedId(newConvo.id)
    setSelectedName(user.username)
    setShowNewChat(false)
    setEmailQuery('')
    setSearchResults([])
  }

  const openConversation = (c: Conversation) => {
    setSelectedId(c.id)
    setSelectedName(c.name)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <div
        className="chat-sidebar"
        style={{
          width: 320,
          maxWidth: '100%',
          borderRight: '1px solid #e0e0e0',
          display: selectedId ? 'none' : 'flex',
          flexDirection: 'column',
          background: '#fff',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#075E54', color: '#fff' }}>
          <strong>Elite-Elator</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowNewChat(true)}
              title="New chat"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}
            >
              ✎
            </button>
            <button onClick={handleLogout} style={{ fontSize: 12, background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: 6, padding: '4px 8px' }}>
              Log out
            </button>
          </div>
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
          {loadingConvos && <div style={{ padding: 12, color: '#999', fontSize: 13 }}>Loading...</div>}
          {!loadingConvos && filteredConversations.length === 0 && (
            <div style={{ padding: 12, color: '#999', fontSize: 13 }}>No conversations yet — tap ✎ to start one</div>
          )}
          {filteredConversations.map((c) => (
            <div
              key={c.id}
              onClick={() => openConversation(c)}
              style={{ padding: 12, borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ccc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                {c.name[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: '#666' }}>{c.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="chat-main"
        style={{
          flex: 1,
          display: selectedId ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        {selectedId ? (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', background: '#075E54', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="back-button"
                onClick={() => setSelectedId(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'none' }}
              >
                ←
              </button>
              <strong>{selectedName}</strong>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.85)' }}>
              {messages.map((m) => {
                const isMe = m.sender_id === currentUserId
                const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
                    <div style={{ background: isMe ? '#DCF8C6' : '#fff', color: '#000', padding: '8px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
                      {m.content}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>
                      {time}
                    </div>
                  </div>
                )
              })}
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

      {showNewChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: 360, maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong>New chat</strong>
              <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <input
              type="email"
              placeholder="Search by email address"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, marginBottom: 10 }}
            />
            <button onClick={handleSearchUser} disabled={searching} style={{ width: '100%', padding: 10, background: '#075E54', color: '#fff', border: 'none', borderRadius: 8, marginBottom: 12 }}>
              {searching ? 'Searching...' : 'Search'}
            </button>
            {searchError && <p style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{searchError}</p>}
            {searchResults.map((user) => (
              <div key={user.id} onClick={() => handleStartChat(user)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, cursor: 'pointer', border: '1px solid #f0f0f0', marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                  {user.username[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{user.username}</div>
                  <div style={{ fontSize: 12, color: '#2e7d32' }}>● Available on Elite-Elator</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .chat-sidebar { display: flex !important; }
          .chat-main { display: flex !important; }
          .back-button { display: none !important; }
        }
        @media (max-width: 767px) {
          .back-button { display: inline-block !important; }
          .chat-sidebar { width: 100% !important; }
        }
      `}</style>
    </div>
  )
}