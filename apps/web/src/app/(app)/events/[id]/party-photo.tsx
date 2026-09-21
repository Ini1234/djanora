export function PartyPhoto({
  url,
  label = 'Photo',
  size = 64,
}: {
  url?: string | null
  label?: string
  size?: number
}) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        background: 'var(--color-card, var(--site-card))',
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="party-face h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            objectFit: 'cover',
            objectPosition: 'center',
            imageOrientation: 'from-image',
          }}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[11px]"
          style={{ color: 'var(--color-muted, var(--site-muted))' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
