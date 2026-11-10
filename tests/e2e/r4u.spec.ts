import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

const PASSWORD = 'R4uDemo-2026!'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/dashboard|admin/)
}

async function contextFor(browser: Browser, email: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, email)
  return { context, page }
}

test.describe('authentication', () => {
  test('registers through the form and lands on the dashboard', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Playwright User')
    await page.getByLabel('Email address').fill(`pw${Date.now()}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.getByRole('heading', { name: 'Three ways to begin' })).toBeVisible()
  })

  test('shows a readable error for a wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('user@r4u.dev')
    await page.getByLabel('Password', { exact: true }).fill('not-the-password-1A')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/login/)
  })

  test('sends a guest away from a protected page, and a user away from admin', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/)
    await signIn(page, 'user@r4u.dev')
    await page.goto('/admin')
    await expect(page).toHaveURL(/403/)
  })
})

test.describe('sharing', () => {
  test('a recruiter opens a share link and the owner sees the count move live', async ({
    browser,
  }) => {
    const owner = await contextFor(browser, 'user@r4u.dev')
    await owner.page.getByRole('link', { name: 'Edit Backend Developer CV' }).waitFor()
    const href = await owner.page
      .getByRole('link', { name: 'Edit Backend Developer CV' })
      .getAttribute('href')
    await owner.page.goto(href!.replace('/edit', ''))

    await owner.page.getByRole('button', { name: 'Create a share link' }).click()
    const url = await owner.page.getByLabel('New share link').inputValue()
    const row = owner.page.locator('li', { hasText: '/r/…' }).first()
    await expect(row).toContainText('0 views')

    const recruiter = await browser.newContext({ userAgent: 'playwright-recruiter' })
    const visitor = await recruiter.newPage()
    await visitor.goto(new URL(url).pathname)
    await expect(visitor.getByRole('button', { name: /PDF/ })).toBeVisible()

    await expect(row).toContainText('1 views')
    await recruiter.close()
    await owner.context.close()
  })

  test('downloads a real PDF', async ({ page }) => {
    await signIn(page, 'user@r4u.dev')
    const href = await page
      .getByRole('link', { name: 'Edit Backend Developer CV' })
      .getAttribute('href')
    await page.goto(href!.replace('/edit', ''))
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PDF' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('explains an unknown link instead of showing content', async ({ page }) => {
    await page.goto('/r/thisLinkDoesNotExist_0123456789')
    await expect(page.getByRole('heading', { name: 'This link does not exist' })).toBeVisible()
  })
})

test.describe('real-time review', () => {
  test('a message from the reviewer reaches the owner without a refresh', async ({ browser }) => {
    const owner = await contextFor(browser, 'user@r4u.dev')
    const reviewer = await contextFor(browser, 'reviewer@r4u.dev')

    await owner.page.goto('/reviews')
    await owner.page.getByRole('link', { name: 'Open room' }).first().click()
    await owner.page.waitForURL(/\/reviews\/[0-9a-f]{24}/)
    await reviewer.page.goto(owner.page.url())

    const text = `Live check ${Date.now()}`
    await reviewer.page.getByLabel('Message').fill(text)
    await reviewer.page.getByLabel('Message').press('Enter')
    await expect(owner.page.getByText(text)).toBeVisible()

    await owner.context.close()
    await reviewer.context.close()
  })
})

test.describe('administration', () => {
  test('the admin console states the privacy boundary on every screen', async ({ page }) => {
    await signIn(page, 'admin@r4u.dev')
    for (const path of ['/admin', '/admin/users', '/admin/templates', '/admin/reports']) {
      await page.goto(path)
      await expect(page.getByText('Resume content is not visible to administrators.')).toBeVisible()
    }
  })
})

test.describe('responsive', () => {
  for (const width of [390, 768, 1440]) {
    test(`no horizontal scroll on the landing page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)
    })
  }

  test('the navigation collapses to a menu on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'user@r4u.dev')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('link', { name: 'Reviews' })).toBeVisible()
  })
})
