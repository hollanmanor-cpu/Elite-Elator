'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    // Detect iOS Safari specifically (no beforeinstallprompt event exists there)
    const ua = window.navigator.userAgent
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(iosDevice)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null)
    }
  }

  if (installed) return null

  // iOS: no install API exists, so show a button that reveals manual instructions instead
  if (isIOS) {
    return (
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => setShowIOSInstructions((prev) => !prev)}
          style={{
            padding: '10px 20px',
            background: '#25D366',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          📲 Install App
        </button>
        {showIOSInstructions && (
          <div
            style={{
              marginTop: 12,
              padding: 16,
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 8,
              maxWidth: 300,
              fontSize: 14,
              color: '#333',
              textAlign: 'left',
            }}
          >
            <strong>To install on iPhone/iPad:</strong>
            <ol style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Tap the <strong>Share</strong> icon (square with an arrow) in Safari&apos;s toolbar</li>
              <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></li>
              <li>Tap <strong>&quot;Add&quot;</strong> in the top right</li>
            </ol>
          </div>
        )}
      </div>
    )
  }

  // Android/desktop Chrome etc: only show once the browser has offered the real prompt
  if (!deferredPrompt) return null

  return (
    <button
      onClick={handleInstallClick}
      style={{
        padding: '10px 20px',
        background: '#25D366',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600,
        marginTop: 12,
      }}
    >
      📲 Install App
    </button>
  )
}