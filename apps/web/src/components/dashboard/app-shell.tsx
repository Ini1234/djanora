import type { UserMe } from '@/lib/api.types'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'
import { ToastContainer } from '@/components/ui/toast-container'

interface AppShellProps {
  user: UserMe
  children: React.ReactNode
}

export function AppShell({ user, children }: AppShellProps) {
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || 'there'
  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  return (
    <>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--page-bg)' }}>
        <Sidebar
          displayName={displayName}
          initials={initials}
          avatarUrl={user.avatarUrl}
          role={user.role}
          hasVendorProfile={user.hasVendorProfile}
          activeMode={user.activeMode}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <MobileNav
            displayName={displayName}
            initials={initials}
            avatarUrl={user.avatarUrl}
            activeMode={user.activeMode}
            hasVendorProfile={user.hasVendorProfile}
            role={user.role}
          />

          <main
            id="main-content"
            className="flex-1 overflow-y-auto relative"
            style={{
              background: 'var(--page-bg)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--scrollbar)',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Global toast overlay — renders above everything */}
      <ToastContainer vendorMode={user.activeMode === 'vendor'} />
    </>
  )
}
