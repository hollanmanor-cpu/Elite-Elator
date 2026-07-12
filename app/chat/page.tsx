'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Conversation = {
  id: string
  name: string
  lastMessage: string
  otherUserId: string
  unreadCount: number
  lastReadAt: string
  lastActivity: string
}
type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  conversation_id: string
  media_url?: string | null
}
type SearchResult = { id: string; username: string; email: string }

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null)
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState<string>(new Date(0).toISOString())
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [showNewChat, setShowNewChat] = useState(false)
  const [emailQuery, setEmailQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return
    setLoadingConvos(true)

    const { data: myRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', currentUserId)

    const convoIds = (myRows ?? []).map((r) => r.conversation_id)
    if (convoIds.length === 0) {
      setConversations([])
      setLoadingConvos(false)
      return
    }

    const lastReadMap = new Map((myRows ?? []).map((r) => [r.conversation_id, r.last_read_at]))

    const { data: otherRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles(username)')
      .in('conversation_id', convoIds)
      .neq('user_id', currentUserId)

    const result: Conversation[] = []
    for (const row of otherRows ?? []) {
      const lastReadAt = lastReadMap.get(row.conversation_id) ?? new Date(0).toISOString()

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('conversation_id', row.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { count: unreadCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', row.conversation_id)
        .neq('sender_id', currentUserId)
        .gt('created_at', lastReadAt)

      result.push({
        id: row.conversation_id,
        otherUserId: row.user_id,
        // @ts-expect-error profiles is joined as an object
        name: row.profiles?.username ?? 'Unknown',
        lastMessage: lastMsg?.content ?? 'Say hello 👋',
        unreadCount: unreadCount ?? 0,
        lastReadAt,
        lastActivity: lastMsg?.created_at ?? new Date(0).toISOString(),
      })
    }

    setConversations(result)
    setLoadingConvos(false)
  }, [currentUserId])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`participant-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${currentUserId}` },
        () => loadConversations()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, loadConversations])

  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return

    const channel = supabase
      .channel(`sidebar-messages-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== newMsg.conversation_id) return c
              const isFromOther = newMsg.sender_id !== currentUserId
              const isCurrentlyOpen = selectedId === c.id
              return {
                ...c,
                lastMessage: newMsg.content,
                lastActivity: newMsg.created_at,
                unreadCount: isFromOther && !isCurrentlyOpen ? c.unreadCount + 1 : c.unreadCount,
              }
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, conversations.length, selectedId])

  useEffect(() => {
    if (!selectedId) return

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, conversation_id, media_url')
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
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || !selectedOtherUserId) return

    const loadOtherReadStatus = async () => {
      const { data } = await supabase
        .from('conversation_participants')
        .select('last_read_at')
        .eq('conversation_id', selectedId)
        .eq('user_id', selectedOtherUserId)
        .maybeSingle()
      setOtherUserLastReadAt(data?.last_read_at ?? new Date(0).toISOString())
    }
    loadOtherReadStatus()

    const channel = supabase
      .channel(`read-status-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string }
          if (updated.user_id === selectedOtherUserId) {
            setOtherUserLastReadAt(updated.last_read_at)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedId, selectedOtherUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

  const filteredConversations = conversations
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))

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

    if (error) console.error('Send failed:', error.message)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId || !currentUserId) return

    setUploading(true)

    const fileExt = file.name.split('.').pop()
    const filePath = `${currentUserId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file)

    if (uploadError) {
      setUploading(false)
      alert('Upload failed: ' + uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath)

    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: selectedId,
      sender_id: currentUserId,
      content: file.type.startsWith('image/') ? '📷 Photo' : '📎 File',
      media_url: urlData.publicUrl,
    })

    setUploading(false)

    if (msgError) {
      alert('Could not send media: ' + msgError.message)
    }

    e.target.value = ''
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
      openConversation(existing)
      setShowNewChat(false)
      setEmailQuery('')
      setSearchResults([])
      return
    }

    const { data: myConvoIds } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    const ids = (myConvoIds ?? []).map((r) => r.conversation_id)
    if (ids.length > 0) {
      const { data: match } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
        .in('conversation_id', ids)
        .maybeSingle()

      if (match) {
        setSelectedId(match.conversation_id)
        setSelectedName(user.username)
        setSelectedOtherUserId(user.id)
        setShowNewChat(false)
        setEmailQuery('')
        setSearchResults([])
        await loadConversations()
        return
      }
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
    setSelectedOtherUserId(user.id)
    setShowNewChat(false)
    setEmailQuery('')
    setSearchResults([])
  }

  const openConversation = async (c: Conversation) => {
    setSelectedId(c.id)
    setSelectedName(c.name)
    setSelectedOtherUserId(c.otherUserId)

    setConversations((prev) =>
      prev.map((conv) => (conv.id === c.id ? { ...conv, unreadCount: 0 } : conv))
    )

    if (currentUserId) {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', c.id)
        .eq('user_id', currentUserId)
    }
  }

  const handleDeleteChat = async (conversationId: string) => {
    if (!currentUserId) return
    const confirmed = window.confirm('Delete this chat? This only removes it from your side.')
    if (!confirmed) return

    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)

    if (error) {
      alert('Could not delete chat: ' + error.message)
      return
    }

    setConversations((prev) => prev.filter((c) => c.id !== conversationId))
    if (selectedId === conversationId) {
      setSelectedId(null)
      setSelectedName('')
      setSelectedOtherUserId(null)
    }
    setMenuOpenFor(null)
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
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 20, background: '#f0f2f5', color: '#000' }}
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
              style={{
                padding: 12,
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                position: 'relative',
                background: c.unreadCount > 0 ? '#f7fdfb' : 'transparent',
              }}
            >
              <div onClick={() => openConversation(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ccc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
                  {c.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: c.unreadCount > 0 ? 700 : 600 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: c.unreadCount > 0 ? '#111' : '#666', fontWeight: c.unreadCount > 0 ? 600 : 400 }}>
                    {c.lastMessage}
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <div
                    style={{
                      background: '#25D366',
                      color: '#fff',
                      borderRadius: '50%',
                      minWidth: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '0 6px',
                    }}
                  >
                    {c.unreadCount}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenFor(menuOpenFor === c.id ? null : c.id)
                }}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666', padding: 4 }}
              >
                ⋮
              </button>

              {menuOpenFor === c.id && (
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 40,
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 10,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteChat(c.id)
                    }}
                    style={{ padding: '8px 16px', background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Delete chat
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main" style={{ flex: 1, display: selectedId ? 'flex' : 'none', flexDirection: 'column' }}>
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
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                backgroundColor: '#e5ded6',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='%23d4cabd' fill-opacity='0.6'%3E%3Cpath d='M20 20c5 0 8 3 8 8s-3 8-8 8-8-3-8-8 3-8 8-8z'/%3E%3Cpath d='M70 10c3 0 5 2 5 5s-2 5-5 5-5-2-5-5 2-5 5-5z'/%3E%3Cpath d='M50 60l4 8h-8z'/%3E%3Cpath d='M85 55c4 0 6 2 6 6s-2 6-6 6-6-2-6-6 2-6 6-6z'/%3E%3Cpath d='M10 70c3 0 5 2 5 5s-2 5-5 5-5-2-5-5 2-5 5-5z'/%3E%3Cpath d='M40 5c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4z'/%3E%3C/g%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
              }}
            >
              {messages.map((m) => {
                const isMe = m.sender_id === currentUserId
                const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const isRead = isMe && m.created_at <= otherUserLastReadAt

                return (
                  <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
                    <div style={{ background: isMe ? '#DCF8C6' : '#fff', color: '#000', padding: '8px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
                      {m.media_url ? (
                        m.content === '📷 Photo' ? (
                          <a href={m.media_url} target="_blank" rel="noopener noreferrer">
                            <img src={m.media_url} alt="Shared media" style={{ maxWidth: 220, borderRadius: 8, display: 'block' }} />
                          </a>
                        ) : (
                          <a href={m.media_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3' }}>
                            {m.content}
                          </a>
                        )
                      ) : (
                        m.content
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#999',
                        marginTop: 2,
                        textAlign: isMe ? 'right' : 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                        gap: 4,
                      }}
                    >
                      {time}
                      {isMe && (
                        <svg
                          width="16"
                          height="11"
                          viewBox="0 0 16 11"
                          style={{ display: 'inline-block' }}
                        >
                          <path
                            d="M1 5.5L4.5 9L11 1.5"
                            fill="none"
                            stroke={isRead ? '#25D366' : '#999'}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M5 5.5L8.5 9L15 1.5"
                            fill="none"
                            stroke={isRead ? '#25D366' : '#999'}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8, background: '#f0f2f5', alignItems: 'center' }}>
              <label style={{ cursor: 'pointer', fontSize: 20, padding: 4 }}>
                📎
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
              <input
                type="text"
                placeholder={uploading ? 'Uploading...' : 'Type a message'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={uploading}
                style={{ flex: 1, padding: 10, border: 'none', borderRadius: 20, color: '#000' }}
              />
              <button onClick={handleSend} disabled={uploading} style={{ padding: '8px 16px', background: '#075E54', color: '#fff', border: 'none', borderRadius: 20 }}>
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
              style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, marginBottom: 10, color: '#000' }}
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