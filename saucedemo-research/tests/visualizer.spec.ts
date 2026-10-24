import { expect, test } from '@playwright/test';

test('visualizer loads the example and animates the claim review pipeline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Review AI-generated test claims/i })).toBeVisible();
  await expect(page.locator('#scenario-json')).toHaveValue(/saucedemo-login-pair-example/);
  await page.getByRole('button', { name: /Run analysis/ }).click();

  await expect(page.locator('#result-state')).toContainText('Inconsistency signal found', {
    timeout: 10_000,
  });
  await expect(page.locator('#review-queue')).toContainText('paired runs disagree');
  await expect(page.locator('#review-queue')).toContainText('not found in supplied evidence');
  await expect(page.locator('#scenario-warnings')).toContainText('missing from run');
  await expect(page.locator('[data-step="review"]')).toHaveClass(/done/);
});

test('visualizer reports invalid scenario input instead of crashing', async ({ page }) => {
  await page.goto('/');
  await page.locator('#scenario-json').fill('{not json}');
  await page.getByRole('button', { name: /Run analysis/ }).click();

  await expect(page.getByRole('alert')).toContainText('Could not parse JSON');
});

test('visualizer loads the backpack checkout pair for research review', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /E2E example/ }).click();
  await expect(page.locator('#scenario-json')).toHaveValue(/saucedemo-backpack-checkout-e2e/);
  await expect(page.locator('#scenario-json')).toHaveValue(/Researcher-authored structured claims/);

  await page.getByRole('button', { name: /Run analysis/ }).click();

  await expect(page.locator('#result-state')).toContainText('No pair disagreement', {
    timeout: 10_000,
  });
  await expect(page.locator('#review-queue')).toContainText('checkout.order_confirmation.is_visible');
  await expect(page.locator('#review-queue')).toContainText('not found in supplied evidence');
});
