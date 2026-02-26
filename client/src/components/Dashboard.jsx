import SessionsTable from './SessionsTable'
import GraphWidget from './GraphWidget'

export default function Dashboard() {
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
        {/* Greeting - top left */}
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

      {/* Main content grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '24px',
        alignItems: 'start',
      }}>
        {/* Left — Sessions table */}
        <SessionsTable />

        {/* Right — Graph */}
        <div style={{ height: '420px' }}>
          <GraphWidget />
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #00e676; }
          50% { opacity: 0.6; box-shadow: 0 0 14px #00e676; }
        }
      `}</style>
    </div>
  )
}
