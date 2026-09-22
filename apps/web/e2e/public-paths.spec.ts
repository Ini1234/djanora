import { expect, test } from '@playwright/test'

test('public marketing pages stay reachable without a session', async ({ page }) => {
  for (const path of ['/about', '/privacy', '/terms']) {
    const response = await page.goto(path)
    expect(response?.ok(), path).toBeTruthy()
    await expect(page.locator('h1')).toBeVisible()
  }
})

test('robots.txt is public and does not require sign-in', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.ok()).toBeTruthy()
  const body = await response.text()
  expect(body).toMatch(/User-agent/i)
  expect(body).not.toMatch(/Sign in/i)
})
