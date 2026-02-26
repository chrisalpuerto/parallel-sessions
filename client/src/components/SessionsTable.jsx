import { useState, useEffect } from 'react'

const DEMO_ROW = {
  id: 'demo',
  instance: 'prod-session-01',
  ip: '192.168.1.101',
  status: 'running',
  email: 'admin@example.com',
  option: 'automatic',
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' },
  running:     { label: 'Running',     color: '#42a5f5', bg: 'rgba(66,165,245,0.12)' },
  succeed:     { label: 'Succeed',     color: '#00e676', bg: 'rgba(0,230,118,0.12)'  },
  failed:      { label: 'Failed',      color: '#ff5252', bg: 'rgba(255,82,82,0.12)'  },
}

const OPTION_CONFIG = {
  manual:    { label: 'Manual',    color: '#ffca28', bg: 'rgba(255,202,40,0.12)'  },
  automatic: { label: 'Automatic', color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 500,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: cfg.color,
        boxShadow: status === 'running' ? `0 0 6px ${cfg.color}` : 'none',
        animation: status === 'running' ? 'pulse 2s infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  )
}

function OptionBadge({ option }) {
  const cfg = OPTION_CONFIG[option] ?? { label: option, color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 500,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

const COL_STYLE = {
  padding: '14px 16px',
  fontSize: '14px',
  color: 'rgba(255,255,255,0.75)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const HEAD_STYLE = {
  padding: '12px 16px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  whiteSpace: 'nowrap',
}

function SessionRow({ session, isDemo }) {
  return (
    <tr style={{
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <td style={COL_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(108,99,255,0.15)',
            border: '1px solid rgba(108,99,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 700,
            color: '#6c63ff',
            flexShrink: 0,
          }}>
            {session.instance?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{session.instance}</span>
        </div>
      </td>
      <td style={COL_STYLE}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.55)',
          background: 'rgba(255,255,255,0.05)',
          padding: '3px 8px',
          borderRadius: '4px',
        }}>
          {session.ip}
        </span>
      </td>
      <td style={COL_STYLE}>
        <StatusBadge status={session.status} />
      </td>
      <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>
        {session.email}
      </td>
      <td style={COL_STYLE}>
        <OptionBadge option={session.option} />
      </td>
    </tr>
  )
}

export default function SessionsTable() {
  const [backendRows, setBackendRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:8000/sessions')
      .then(r => r.json())
      .then(data => {
        setBackendRows(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const allRows = [DEMO_ROW, ...backendRows]

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>Sessions</h3>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            {allRows.length} total &mdash; {allRows.filter(r => r.status === 'running').length} running
          </p>
        </div>
        {loading && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            Syncing...
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Instance</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>IP Address</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Status</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Email</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Option</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((session, i) => (
              <SessionRow key={session.id ?? i} session={session} isDemo={session.id === 'demo'} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
