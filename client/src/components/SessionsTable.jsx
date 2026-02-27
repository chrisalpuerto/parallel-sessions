import { useState } from 'react'

const PAGE_SIZE = 10

const STATUS_CONFIG = {
  not_started:     { label: 'Not Started',    color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' },
  starting:        { label: 'Starting',        color: '#ffa726', bg: 'rgba(255,167,38,0.12)'  },
  running:         { label: 'Running',         color: '#42a5f5', bg: 'rgba(66,165,245,0.12)'  },
  awaiting_orders: { label: 'Awaiting Orders', color: '#ab47bc', bg: 'rgba(171,71,188,0.12)'  },
  manual_takeover: { label: 'Manual Takeover', color: '#ffca28', bg: 'rgba(255,202,40,0.12)'  },
  running_auto:    { label: 'Auto Running',    color: '#42a5f5', bg: 'rgba(66,165,245,0.12)'  },
  login_required:    { label: 'Login Req',     color: '#ff9800', bg: 'rgba(255,152,0,0.12)'    },
  shipping_required: { label: 'Shipping Req', color: '#29b6f6', bg: 'rgba(41,182,246,0.12)'  },
  card_required:     { label: 'Card Req',     color: '#ec407a', bg: 'rgba(236,64,122,0.12)'  },
  receipt_required:  { label: 'Receipt Req', color: '#ab47bc', bg: 'rgba(171,71,188,0.12)'  },
  complete:          { label: 'COMPLETE!',   color: '#00e676', bg: 'rgba(0,230,118,0.18)'   },
  finished:          { label: 'Finished',    color: '#00e676', bg: 'rgba(0,230,118,0.12)'   },
  error:           { label: 'Error',           color: '#ff5252', bg: 'rgba(255,82,82,0.12)'   },
}

const OPTION_CONFIG = {
  manual:    { label: 'Manual',    color: '#ffca28', bg: 'rgba(255,202,40,0.12)'  },
  automatic: { label: 'Automatic', color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' },
  auto:      { label: 'Auto',      color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' },
}

const ACTIVE_STATUSES = new Set(['starting', 'running', 'awaiting_orders', 'running_auto', 'manual_takeover', 'login_required', 'shipping_required', 'card_required', 'receipt_required'])

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

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  color: '#fff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const SELECT_STYLE = {
  ...INPUT_STYLE,
  cursor: 'pointer',
}

const OVERLAY_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
}

const MODAL_CARD_STYLE = {
  background: '#1a1a2e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '14px',
  padding: '28px 32px',
  width: '460px',
  maxWidth: '95vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

function ModalHeader({ title, subtitle }) {
  return (
    <div>
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{subtitle}</p>}
    </div>
  )
}

function FieldRow({ children }) {
  return <div style={{ display: 'flex', gap: '10px' }}>{children}</div>
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
      <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SessionRow({ session, sendCommand, targetSite }) {
  const isAwaiting         = session.status === 'awaiting_orders'
  const isLoginRequired    = session.status === 'login_required'
  const isShippingRequired = session.status === 'shipping_required'
  const isCardRequired     = session.status === 'card_required'
  const isReceiptRequired  = session.status === 'receipt_required'

  // Login state
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail]         = useState('')
  const [loginPassword, setLoginPassword]   = useState('')

  // Shipping state
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [shFirstName, setShFirstName] = useState('')
  const [shLastName,  setShLastName]  = useState('')
  const [shAddress,   setShAddress]   = useState('')
  const [shApartment, setShApartment] = useState('')
  const [shCity,      setShCity]      = useState('')
  const [shState,     setShState]     = useState('California')
  const [shZip,       setShZip]       = useState('')

  // Card state
  // Receipt state
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptEmail,     setReceiptEmail]     = useState('')

  const [showCardModal,     setShowCardModal]     = useState(false)
  const [cdFirstName,       setCdFirstName]       = useState('')
  const [cdLastName,        setCdLastName]        = useState('')
  const [cdCardNumber,      setCdCardNumber]      = useState('')
  const [cdCvc,             setCdCvc]             = useState('')
  const [cdMonth,           setCdMonth]           = useState('')
  const [cdYear,            setCdYear]            = useState('')
  const [cdSameAsShipping,  setCdSameAsShipping]  = useState(false)
  const [cdPhone,           setCdPhone]           = useState('')
  const [cdAddress,         setCdAddress]         = useState('')
  const [cdApartment,       setCdApartment]       = useState('')
  const [cdCity,            setCdCity]            = useState('')
  const [cdState,           setCdState]           = useState('California')
  const [cdZip,             setCdZip]             = useState('')

  const handleLoginSubmit = (e) => {
    e.preventDefault()
    sendCommand(session.instance, { email: loginEmail, password: loginPassword })
    setShowLoginModal(false)
    setLoginEmail('')
    setLoginPassword('')
  }

  const handleShippingSubmit = (e) => {
    e.preventDefault()
    sendCommand(session.instance, {
      firstName: shFirstName, lastName: shLastName,
      address: shAddress, apartment: shApartment,
      city: shCity, state: shState, zip: shZip,
    })
    setShowShippingModal(false)
  }

  const handleReceiptSubmit = (e) => {
    e.preventDefault()
    sendCommand(session.instance, { receiptEmail })
    setShowReceiptModal(false)
    setReceiptEmail('')
  }

  const handleCardSubmit = (e) => {
    e.preventDefault()
    sendCommand(session.instance, {
      firstName: cdFirstName, lastName: cdLastName,
      cardNumber: cdCardNumber, cvc: cdCvc,
      month: cdMonth, year: cdYear,
      sameAsShipping: cdSameAsShipping,
      phone: cdPhone, address: cdAddress, apartment: cdApartment,
      city: cdCity, state: cdState, zip: cdZip,
    })
    setShowCardModal(false)
  }

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
        {isLoginRequired && (
          <button style={CMD_BTN('#ff9800')} onClick={() => setShowLoginModal(true)}>
            Login
          </button>
        )}
        {isShippingRequired && (
          <button style={CMD_BTN('#29b6f6')} onClick={() => setShowShippingModal(true)}>
            Shipping
          </button>
        )}
        {isCardRequired && (
          <button style={CMD_BTN('#ec407a')} onClick={() => setShowCardModal(true)}>
            Card
          </button>
        )}
        {isReceiptRequired && (
          <button style={CMD_BTN('#ab47bc')} onClick={() => setShowReceiptModal(true)}>
            Receipt
          </button>
        )}
        {!isLoginRequired && !isShippingRequired && !isCardRequired && !isReceiptRequired && (
          <OptionBadge option={session.option} />
        )}

        {/* ── Login Modal ─────────────────────────────────────────────────── */}
        {showLoginModal && (
          <div style={OVERLAY_STYLE} onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false) }}>
            <div style={MODAL_CARD_STYLE}>
              <ModalHeader title={`Login — Bot ${session.instance}`} subtitle="Enter credentials to resume the session" />
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="email" placeholder="Email" autoFocus required value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)} style={INPUT_STYLE} />
                <input type="password" placeholder="Password" required value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)} style={INPUT_STYLE} />
                <button type="submit" style={{ padding: '9px', borderRadius: '8px', border: 'none', background: '#ff9800', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                  Send Credentials
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Shipping Address Modal ──────────────────────────────────────── */}
        {showShippingModal && (
          <div style={OVERLAY_STYLE} onClick={(e) => { if (e.target === e.currentTarget) setShowShippingModal(false) }}>
            <div style={MODAL_CARD_STYLE}>
              <ModalHeader title={`Shipping Address — Bot ${session.instance}`} subtitle="Enter the shipping details to continue checkout" />
              <form onSubmit={handleShippingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FieldRow>
                  <Field label="First Name">
                    <input placeholder="First Name" required value={shFirstName}
                      onChange={e => setShFirstName(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                  <Field label="Last Name">
                    <input placeholder="Last Name" required value={shLastName}
                      onChange={e => setShLastName(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                </FieldRow>
                <Field label="Address">
                  <input placeholder="Street Address" required value={shAddress}
                    onChange={e => setShAddress(e.target.value)} style={INPUT_STYLE} />
                </Field>
                <Field label="Apartment / Unit (optional)">
                  <input placeholder="Apt, Suite, Unit…" value={shApartment}
                    onChange={e => setShApartment(e.target.value)} style={INPUT_STYLE} />
                </Field>
                <FieldRow>
                  <Field label="City">
                    <input placeholder="City" required value={shCity}
                      onChange={e => setShCity(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                  <Field label="State">
                    <select required value={shState} onChange={e => setShState(e.target.value)} style={SELECT_STYLE}>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Zip / Postal">
                    <input placeholder="90041" required value={shZip}
                      onChange={e => setShZip(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                </FieldRow>
                <button type="submit" style={{ padding: '9px', borderRadius: '8px', border: 'none', background: '#29b6f6', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                  Done
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Receipt Email Modal ─────────────────────────────────────────── */}
        {showReceiptModal && (
          <div style={OVERLAY_STYLE} onClick={(e) => { if (e.target === e.currentTarget) setShowReceiptModal(false) }}>
            <div style={MODAL_CARD_STYLE}>
              <ModalHeader
                title={`Receipt Email — Bot ${session.instance}`}
                subtitle="Enter the email address for your order receipt"
              />
              <form onSubmit={handleReceiptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="email" placeholder="receipt@email.com" autoFocus required
                  value={receiptEmail} onChange={e => setReceiptEmail(e.target.value)}
                  style={INPUT_STYLE}
                />
                <button type="submit" style={{ padding: '9px', borderRadius: '8px', border: 'none', background: '#ab47bc', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                  Done
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Card Details Modal ──────────────────────────────────────────── */}
        {showCardModal && (
          <div style={OVERLAY_STYLE} onClick={(e) => { if (e.target === e.currentTarget) setShowCardModal(false) }}>
            <div style={MODAL_CARD_STYLE}>
              <ModalHeader title={`Card Details — Bot ${session.instance}`} subtitle="Enter payment information to continue checkout" />
              <form onSubmit={handleCardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FieldRow>
                  <Field label="First Name">
                    <input placeholder="First Name" required value={cdFirstName}
                      onChange={e => setCdFirstName(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                  <Field label="Last Name">
                    <input placeholder="Last Name" required value={cdLastName}
                      onChange={e => setCdLastName(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="Card Number">
                    <input placeholder="Card Number" required value={cdCardNumber}
                      onChange={e => setCdCardNumber(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                  <Field label="CVC / CVV">
                    <input placeholder="CVC" required value={cdCvc}
                      onChange={e => setCdCvc(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: '90px' }} />
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="Month">
                    <input placeholder="MM" required maxLength={2} value={cdMonth}
                      onChange={e => setCdMonth(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                  <Field label="Year">
                    <input placeholder="YYYY" required maxLength={4} value={cdYear}
                      onChange={e => setCdYear(e.target.value)} style={INPUT_STYLE} />
                  </Field>
                </FieldRow>
                <Field label="Contact Phone">
                  <input placeholder="(323) 000-0000" value={cdPhone}
                    onChange={e => setCdPhone(e.target.value)} style={INPUT_STYLE} />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                  <input type="checkbox" checked={cdSameAsShipping}
                    onChange={e => setCdSameAsShipping(e.target.checked)}
                    style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                  Same as my shipping address
                </label>
                {!cdSameAsShipping && (
                  <>
                    <Field label="Billing Address">
                      <input placeholder="Street Address" required value={cdAddress}
                        onChange={e => setCdAddress(e.target.value)} style={INPUT_STYLE} />
                    </Field>
                    <Field label="Apartment / Unit (optional)">
                      <input placeholder="Apt, Suite, Unit…" value={cdApartment}
                        onChange={e => setCdApartment(e.target.value)} style={INPUT_STYLE} />
                    </Field>
                    <FieldRow>
                      <Field label="City">
                        <input placeholder="City" required value={cdCity}
                          onChange={e => setCdCity(e.target.value)} style={INPUT_STYLE} />
                      </Field>
                      <Field label="State">
                        <select required value={cdState} onChange={e => setCdState(e.target.value)} style={SELECT_STYLE}>
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Zip / Postal">
                        <input placeholder="90041" required value={cdZip}
                          onChange={e => setCdZip(e.target.value)} style={INPUT_STYLE} />
                      </Field>
                    </FieldRow>
                  </>
                )}
                <button type="submit" style={{ padding: '9px', borderRadius: '8px', border: 'none', background: '#ec407a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                  Done
                </button>
              </form>
            </div>
          </div>
        )}
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
