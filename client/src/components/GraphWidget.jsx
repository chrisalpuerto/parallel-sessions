import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const demoData = [
  { time: '00:00', sessions: 4 },
  { time: '01:00', sessions: 3 },
  { time: '02:00', sessions: 2 },
  { time: '03:00', sessions: 2 },
  { time: '04:00', sessions: 1 },
  { time: '05:00', sessions: 3 },
  { time: '06:00', sessions: 5 },
  { time: '07:00', sessions: 8 },
  { time: '08:00', sessions: 12 },
  { time: '09:00', sessions: 18 },
  { time: '10:00', sessions: 22 },
  { time: '11:00', sessions: 19 },
  { time: '12:00', sessions: 25 },
  { time: '13:00', sessions: 21 },
  { time: '14:00', sessions: 27 },
  { time: '15:00', sessions: 24 },
  { time: '16:00', sessions: 30 },
  { time: '17:00', sessions: 28 },
  { time: '18:00', sessions: 20 },
  { time: '19:00', sessions: 15 },
  { time: '20:00', sessions: 12 },
  { time: '21:00', sessions: 9 },
  { time: '22:00', sessions: 7 },
  { time: '23:00', sessions: 5 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(13, 14, 30, 0.95)',
        border: '1px solid rgba(108, 99, 255, 0.4)',
        borderRadius: '8px',
        padding: '10px 14px',
        backdropFilter: 'blur(12px)',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>{label}</p>
        <p style={{ color: '#6c63ff', fontWeight: 600, fontSize: '15px' }}>
          {payload[0].value} <span style={{ fontWeight: 400, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>sessions</span>
        </p>
      </div>
    )
  }
  return null
}

export default function GraphWidget() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '24px 20px 16px',
      backdropFilter: 'blur(12px)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Active Sessions
            </p>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              30
            </h2>
          </div>
          <div style={{
            background: 'rgba(108, 99, 255, 0.15)',
            border: '1px solid rgba(108, 99, 255, 0.25)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#6c63ff',
          }}>
            Last 24h
          </div>
        </div>
        <p style={{ color: '#00e676', fontSize: '13px', fontWeight: 500, marginTop: '8px' }}>
          ↑ 12% from yesterday
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={demoData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(108,99,255,0.3)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="#6c63ff"
              strokeWidth={2}
              fill="url(#sessionGradient)"
              activeDot={{ r: 5, fill: '#6c63ff', stroke: 'rgba(108,99,255,0.3)', strokeWidth: 4 }}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
