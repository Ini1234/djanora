type ClerkTheme = 'light' | 'dark'

const ink = '#18181b'
const paper = '#ffffff'
const fog = '#fafafa'
const zinc = '#52525b'
const stone = '#a1a1aa'
const lineLight = '#e4e4e7'
const lineDark = '#3f3f46'
const inputDark = '#09090b'
const cardDark = '#18181b'

export function clerkAppearanceFor(theme: ClerkTheme) {
  const dark = theme === 'dark'
  const text = dark ? fog : ink
  const muted = dark ? stone : zinc
  const bg = dark ? cardDark : paper
  const inputBg = dark ? inputDark : paper
  const border = dark ? lineDark : lineLight
  const onPrimary = dark ? ink : paper

  return {
    variables: {
      colorPrimary: text,
      colorBackground: bg,
      colorForeground: text,
      colorText: text,
      colorTextSecondary: muted,
      colorTextOnPrimaryBackground: onPrimary,
      colorInputText: text,
      colorInputBackground: inputBg,
      colorNeutral: muted,
      colorDanger: dark ? '#f87171' : '#dc2626',
      colorSuccess: dark ? '#4ade80' : '#16a34a',
      borderRadius: '0.75rem',
      fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      fontSize: '0.9375rem',
    },
    elements: {
      rootBox: { colorScheme: theme },
      cardBox: { colorScheme: theme },
      card: {
        boxShadow: dark ? 'none' : '0 1px 3px 0 rgb(0 0 0 / 0.06)',
        border: `1px solid ${border}`,
        borderRadius: '1.25rem',
        backgroundColor: bg,
        color: text,
      },
      headerTitle: {
        fontFamily: 'var(--font-playfair), Georgia, serif',
        fontSize: '1.5rem',
        fontWeight: '600',
        color: text,
      },
      headerSubtitle: { color: muted, fontSize: '0.875rem' },
      navbar: { backgroundColor: 'transparent', color: text },
      navbarButtons: { color: text },
      navbarButton: { color: text, backgroundColor: 'transparent' },
      navbarButtonIcon: { color: text },
      navbarMobileMenuButton: { color: text },
      logoBox: { color: text },
      logoImage: { opacity: 1 },
      formFieldLabel: { color: text },
      formFieldHintText: { color: muted },
      formFieldInput: {
        borderRadius: '0.75rem',
        borderColor: border,
        backgroundColor: inputBg,
        color: text,
        colorScheme: theme,
      },
      otpCodeFieldInput: {
        borderColor: border,
        backgroundColor: inputBg,
        color: text,
        colorScheme: theme,
      },
      phoneInputBox: {
        borderColor: border,
        backgroundColor: inputBg,
        color: text,
      },
      selectButton: {
        backgroundColor: inputBg,
        color: text,
        borderColor: border,
      },
      identityPreview: {
        backgroundColor: inputBg,
        borderColor: border,
        color: text,
      },
      identityPreviewText: { color: text },
      identityPreviewEditButton: { color: text },
      socialButtonsBlockButton: {
        borderRadius: '9999px',
        borderColor: border,
        backgroundColor: inputBg,
        color: text,
      },
      socialButtonsBlockButtonText: { color: text, fontWeight: '500' },
      alternativeMethodsBlockButton: {
        borderColor: border,
        backgroundColor: inputBg,
        color: text,
      },
      dividerText: { color: muted },
      footerActionText: { color: muted },
      footerActionLink: { color: text, fontWeight: '500' },
      formButtonPrimary: {
        backgroundColor: text,
        color: onPrimary,
        borderRadius: '9999px',
        fontSize: '0.9375rem',
        fontWeight: '500',
      },
    },
  } as const
}

export const CLERK_APPEARANCE = {
  light: clerkAppearanceFor('light'),
  dark: clerkAppearanceFor('dark'),
} as const

/** Light fallback for server-rendered Clerk trees before theme hydrates. */
export const clerkAppearance = CLERK_APPEARANCE.light
