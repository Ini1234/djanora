import { jsonLdScript } from '@/lib/seo'

export function JsonLd({ data }: { data: unknown }) {
  if (data == null) return null
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  )
}
