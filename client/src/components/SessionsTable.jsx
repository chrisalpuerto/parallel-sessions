import { useState } from 'react'

const PAGE_SIZE = 10

const STATUS_CONFIG = {
  not_started:     { label: 'Not Started',    color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' },
  starting:        { label: 'Starting',        color: '#ffa726', bg: 'rgba(255,167,38,0.12)'  },
  running:         { label: 'Running',         color: '#42a5f5', bg: 'rgba(66,165,245,0.12)'  },
  awaiting_orders: { label: 'Awaiting Orders', color: '#ab47bc', bg: 'rgba(171,71,188,0.12)'  },
  manual_takeover: { label: 'Manual Takeover', color: '#ffca28', bg: 'rgba(255,202,40,0.12)'  },
  running_auto:    { label: 'Auto Running',    color: '#42a5f5', bg: 'rgba(66,165,245,0.12)'  },
  finished:        { label: 'Finished',        color: '#00e676', bg: 'rgba(0,230,118,0.12)'   },
  error:           { label: 'Error',           color: '#ff5252', bg: 'rgba(255,82,82,0.12)'   },
}

const OPTION_CONFIG = {
  manual:    { label: 'Manual',    color: '#ffca28', bg: 'rgba(255,202,40,0.12)'  },
  automatic: { label: 'Automatic', color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' },
  auto:      { label: 'Auto',      color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' },
}

const ACTIVE_STATUSES = new Set(['starting', 'running', 'awaiting_orders', 'running_auto', 'manual_takeover'])

function formatTargetSite(url) {
  try {
    const { hostname, pathname, search, hash } = new URL(url)
    const hasPath = pathname !== '/' || search || hash
    return hostname + (hasPath ? '...' : '')
  } catch {
    return url || '—'
  }
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' }
  const animate = ACTIVE_STATUSES.has(status)
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
        boxShadow: animate ? `0 0 6px ${cfg.color}` : 'none',
        animation: animate ? 'pulse 2s infinite' : 'none',
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

const CMD_BTN = (accent) => ({
  padding: '4px 12px',
  borderRadius: '6px',
  border: `1px solid ${accent}40`,
  background: `${accent}15`,
  color: accent,
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

const CHIP_STYLE = {
  fontFamily: 'monospace',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.05)',
  padding: '3px 8px',
  borderRadius: '4px',
}

function SessionRow({ session, sendCommand, targetSite }) {
  const isAwaiting = session.status === 'awaiting_orders'

  return (
    <tr
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Instance — number only */}
      <td style={COL_STYLE}>
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
        }}>
          {session.instance}
        </div>
      </td>

      {/* Target Site */}
      <td style={COL_STYLE}>
        <span style={CHIP_STYLE}>{targetSite}</span>
      </td>

      {/* IP Address */}
      <td style={COL_STYLE}>
        <span style={CHIP_STYLE}>{session.ip}</span>
      </td>

      {/* Status + command buttons */}
      <td style={COL_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={session.status} />
          {isAwaiting && (
            <>
              <button style={CMD_BTN('#ffca28')} onClick={() => sendCommand(session.instance, 'manual')}>
                Manual
              </button>
              <button style={CMD_BTN('#6c63ff')} onClick={() => sendCommand(session.instance, 'auto')}>
                Auto
              </button>
            </>
          )}
        </div>
      </td>

      {/* Action */}
      <td style={{
        ...COL_STYLE,
        color: session.action && session.action !== 'Idle'
          ? 'rgba(255,255,255,0.65)'
          : 'rgba(255,255,255,0.25)',
        fontSize: '13px',
      }}>
        {session.action || 'Idle'}
      </td>

      <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontStyle: 'italic' }}>
        awaiting
      </td>
      <td style={COL_STYLE}>
        <OptionBadge option={session.option} />
      </td>
    </tr>
  )
}

export default function SessionsTable({ sessions = {}, sendCommand, targetUrl = '' }) {
  const [page, setPage] = useState(0)
  const rows = Object.values(sessions)
  const activeCount = rows.filter(r => ACTIVE_STATUSES.has(r.status)).length
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const targetSite = formatTargetSite(targetUrl)

  const startEntry = rows.length === 0 ? 0 : page * PAGE_SIZE + 1
  const endEntry = Math.min((page + 1) * PAGE_SIZE, rows.length)

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

      {/* Table header */}
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
            {rows.length} total &mdash; {activeCount} active
          </p>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>#</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Target Site</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>IP Address</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Status</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Action</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Email</th>
              <th style={{ ...HEAD_STYLE, textAlign: 'left' }}>Option</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...COL_STYLE, textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '40px' }}>
                  No sessions running — enter a URL above and click Start Bots
                </td>
              </tr>
            ) : (
              pageRows.map(session => (
                <SessionRow key={session.instance} session={session} sendCommand={sendCommand} targetSite={targetSite} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — only shown when needed */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            {startEntry}–{endEntry} of {rows.length}
          </span>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: page === totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
