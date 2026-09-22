import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Djanora — plan your event'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: '#fafafa',
        color: '#18181b',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 40,
          fontSize: 28,
          fontWeight: 600,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            background: '#18181b',
            color: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          D
        </div>
        Djanora
      </div>
      <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.1, maxWidth: 900 }}>
        Plan your event in one place
      </div>
      <div style={{ marginTop: 24, fontSize: 28, color: '#52525b', maxWidth: 800 }}>
        Budget, vendors, guests, and the day-of schedule. Ottawa, Ontario.
      </div>
    </div>,
    size,
  )
}
