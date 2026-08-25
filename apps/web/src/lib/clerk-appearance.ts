export const clerkAppearance = {
  variables: {
    colorPrimary: '#18181b',
    colorBackground: '#ffffff',
    colorForeground: '#18181b',
    colorNeutral: '#71717a',
    colorDanger: '#dc2626',
    colorSuccess: '#16a34a',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    fontSize: '0.9375rem',
  },
  elements: {
    card: {
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
      border: '1px solid #e4e4e7',
      borderRadius: '1.25rem',
    },
    headerTitle: {
      fontFamily: 'var(--font-playfair), Georgia, serif',
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#18181b',
    },
    headerSubtitle: { color: '#52525b', fontSize: '0.875rem' },
    formButtonPrimary: {
      backgroundColor: '#18181b',
      borderRadius: '9999px',
      fontSize: '0.9375rem',
      fontWeight: '500',
    },
    footerActionLink: { color: '#18181b', fontWeight: '500' },
    formFieldInput: { borderRadius: '0.75rem', borderColor: '#e4e4e7' },
    socialButtonsBlockButton: { borderRadius: '9999px', borderColor: '#e4e4e7' },
  },
} as const
