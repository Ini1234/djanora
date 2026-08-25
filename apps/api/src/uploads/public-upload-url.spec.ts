import { publicApiBase, rewriteAppUploadUrl, storedUploadPath } from './public-upload-url'

describe('public upload URLs', () => {
  const env = {
    PUBLIC_API_URL: 'https://test-djanora.azurewebsites.net',
  }

  it('stores a host-agnostic path', () => {
    expect(storedUploadPath('post-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg')).toBe(
      'uploads/post-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    )
  })

  it('prefers PUBLIC_API_URL and strips a trailing /api', () => {
    expect(publicApiBase({ PUBLIC_API_URL: 'https://api.example.com/api/' })).toBe(
      'https://api.example.com',
    )
  })

  it('uses WEBSITE_HOSTNAME when no public API URL is set', () => {
    expect(publicApiBase({ WEBSITE_HOSTNAME: 'test-djanora.azurewebsites.net' })).toBe(
      'https://test-djanora.azurewebsites.net',
    )
  })

  it('does not let a frontend NEXT_PUBLIC_API_URL override the Azure API host', () => {
    expect(
      publicApiBase({
        WEBSITE_HOSTNAME: 'test-djanora.azurewebsites.net',
        NEXT_PUBLIC_API_URL: 'https://test-djanora-fe.azurewebsites.net',
      }),
    ).toBe('https://test-djanora.azurewebsites.net')
  })

  it('rewrites legacy /uploads URLs onto /api/uploads', () => {
    const name = 'post-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg'
    expect(rewriteAppUploadUrl(`http://localhost:3001/uploads/${name}`, env)).toBe(
      `https://test-djanora.azurewebsites.net/api/uploads/${name}`,
    )
    expect(rewriteAppUploadUrl(`uploads/${name}`, env)).toBe(
      `https://test-djanora.azurewebsites.net/api/uploads/${name}`,
    )
  })

  it('leaves external media URLs alone', () => {
    expect(rewriteAppUploadUrl('https://images.unsplash.com/photo-1', env)).toBe(
      'https://images.unsplash.com/photo-1',
    )
  })
})
