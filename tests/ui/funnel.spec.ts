import { expect, test } from '@playwright/test'

test.describe('Launch funnel flow', () => {
  test('routes from homepage to apply and submits application payload', async ({ page }) => {
    let capturedPayload: Record<string, unknown> | null = null

    await page.route('**/api/apply', async route => {
      const req = route.request()
      capturedPayload = req.postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    await page.goto('/')
    await page.getByRole('link', { name: /apply for coaching/i }).first().click()
    await expect(page).toHaveURL(/\/apply$/)

    await expect(page.getByRole('heading', { name: /find your best coaching starting tier/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /what is your main goal right now\?/i })).toBeVisible()

    await page.evaluate(async () => {
      await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'flow-test@example.com',
          firstName: 'Flow',
          goal: 'build_muscle',
          timeline: '1_to_3_months',
          trainingDays: '4',
          supportLevel: 'hybrid_monthly_calls',
          primaryObstacle: 'inconsistent_accountability',
          coachingHistory: 'no_first_time',
          budgetBand: '200_400',
          readiness: 'within_2_weeks',
          recommendedTier: 'hybrid',
        }),
      })
    })

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload?.email).toBe('flow-test@example.com')
    expect(capturedPayload?.recommendedTier).toBe('hybrid')
  })
})
