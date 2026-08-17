export const clerkAppearance = {
  variables: {
    colorPrimary: '#c9973a',
    colorBackground: '#ffffff',
    colorForeground: '#1c1917',
    colorNeutral: '#79716c',
    colorDanger: '#dc2626',
    colorSuccess: '#16a34a',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    fontSize: '0.9375rem',
  },
  elements: {
    card: {
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
      border: '1px solid #e7e5e4',
      borderRadius: '1.25rem',
    },
    headerTitle: {
      fontFamily: 'var(--font-playfair), Georgia, serif',
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#1c1917',
    },
    headerSubtitle: { color: '#79716c', fontSize: '0.875rem' },
    formButtonPrimary: {
      backgroundColor: '#c9973a',
      borderRadius: '9999px',
      fontSize: '0.9375rem',
      fontWeight: '500',
    },
    footerActionLink: { color: '#c9973a', fontWeight: '500' },
    formFieldInput: { borderRadius: '0.75rem', borderColor: '#e7e5e4' },
    socialButtonsBlockButton: { borderRadius: '9999px', borderColor: '#e7e5e4' },
  },
} as const
