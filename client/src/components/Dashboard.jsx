import { useState, useEffect, useRef, useCallback } from 'react'
import SessionsTable from './SessionsTable'
import GraphWidget from './GraphWidget'

export default function Dashboard() {
  const [targetUrl, setTargetUrl] = useState('')
  const [committedUrl, setCommittedUrl] = useState('')
  const [useProxy, setUseProxy] = useState(false)
  const [testActive, setTestActive] = useState(false)
  const [sessions, setSessions] = useState({})
  const wsRef = useRef(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws')
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        setSessions(JSON.parse(event.data))
      } catch {
        // ignore malformed messages
      }
    }

    return () => ws.close()
  }, [])

  const sendCommand = useCallback((sessionId, command) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ session_id: sessionId, command }))
    }
  }, [])

  const handleStart = async () => {
    if (!targetUrl.trim()) return
    setCommittedUrl(targetUrl.trim())
    await fetch('http://localhost:8000/start-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_url: targetUrl.trim(), use_proxy: useProxy }),
    })
    setTestActive(true)
  }

  const handleStop = async () => {
    await fetch('http://localhost:8000/stop-test', { method: 'POST' })
    setTestActive(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      maxWidth: '1440px',
      margin: '0 auto',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '24px',
      }}>
        <div>
          <h1 style={{
            fontSize: '26px',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}>
            Hey, Chris{' '}
            <span style={{ display: 'inline-block' }} role="img" aria-label="waving hand">👋</span>
          </h1>
          <p style={{
            marginTop: '6px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.35)',
            fontWeight: 400,
          }}>
            Here's what's running today.
          </p>
        </div>

        {/* Live dot indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          padding: '8px 14px',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#00e676',
            boxShadow: '0 0 8px #00e676',
            display: 'inline-block',
            animation: 'livePulse 2s infinite',
          }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>Live</span>
        </div>
      </div>

      {/* Control bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '16px 20px',
      }}>
        {/* Local / Proxy toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '3px',
          gap: '2px',
          flexShrink: 0,
          opacity: testActive ? 0.4 : 1,
          pointerEvents: testActive ? 'none' : 'auto',
        }}>
          {[{ label: 'Local', value: false }, { label: 'Proxy IPs', value: true }].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setUseProxy(value)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: useProxy === value ? '#6c63ff' : 'transparent',
                color: useProxy === value ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
          Target Site URL
        </label>
        <input
          type="url"
          value={targetUrl}
          onChange={e => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '9px 14px',
            fontSize: '14px',
            color: '#fff',
            outline: 'none',
            fontFamily: 'monospace',
          }}
          onKeyDown={e => e.key === 'Enter' && !testActive && handleStart()}
        />
        {!testActive ? (
          <button
            onClick={handleStart}
            disabled={!targetUrl.trim()}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: targetUrl.trim() ? '#6c63ff' : 'rgba(108,99,255,0.3)',
              color: targetUrl.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: targetUrl.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            Start Bots
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: 'rgba(255,82,82,0.15)',
              color: '#ff5252',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,82,82,0.3)',
              transition: 'background 0.15s',
            }}
          >
            Stop Bots
          </button>
        )}
      </div>

      {/* Main content grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '24px',
        alignItems: 'start',
      }}>
        <SessionsTable sessions={sessions} sendCommand={sendCommand} targetUrl={committedUrl} />

        <div style={{ height: '420px' }}>
          <GraphWidget />
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #00e676; }
          50% { opacity: 0.6; box-shadow: 0 0 14px #00e676; }
        }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { border-color: rgba(108,99,255,0.5) !important; }
      `}</style>
    </div>
  )
}
