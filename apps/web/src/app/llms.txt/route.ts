import { CONTACT_EMAIL } from '@/lib/contact'
import { PRODUCT_FAQ, SITE_DESCRIPTION, SITE_URL } from '@/lib/seo'

export function GET() {
  const body = [
    '# Djanora',
    '',
    SITE_DESCRIPTION,
    '',
    'Djanora is not a payments processor. Hosts contract with vendors directly. Vendor profiles appear only after Djanora reviews them. The testing sandbox at https://test.djanora.com is not the live product.',
    '',
    '## Pages',
    `- Home: ${SITE_URL}/`,
    `- About: ${SITE_URL}/about`,
    `- For vendors: ${SITE_URL}/for-vendors`,
    `- Contact: ${SITE_URL}/contact`,
    `- Privacy: ${SITE_URL}/privacy`,
    `- Terms: ${SITE_URL}/terms`,
    '',
    '## FAQ',
    ...PRODUCT_FAQ.flatMap((item) => ['', `### ${item.question}`, item.answer]),
    '',
    `Contact: ${CONTACT_EMAIL}`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
