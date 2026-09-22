import type { ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 pt-24">
        {children}
      </main>
      <Footer />
    </>
  )
}

export function MarketingArticle({
  title,
  lede,
  children,
}: {
  title: string
  lede?: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
      {lede ? <p className="text-muted mt-4 text-lg leading-relaxed">{lede}</p> : null}
      <div className="text-foreground mt-10 space-y-6 text-base leading-relaxed">{children}</div>
    </article>
  )
}
