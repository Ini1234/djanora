'use client'

import { useServerInsertedHTML } from 'next/navigation'

export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data)
  useServerInsertedHTML(() => (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  ))
  return null
}
