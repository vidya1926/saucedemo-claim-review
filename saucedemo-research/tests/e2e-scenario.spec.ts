import { expect, test, type Page } from '@playwright/test';
import { analyzeScenario, validateScenario } from '../src/analyzer';
import scenarioFixture from '../fixtures/backpack-checkout-pair.json';

const demoUrl = 'https://www.saucedemo.com/';
const password = 'secret_sauce';
const pairedScenario: unknown = scenarioFixture;
validateScenario(pairedScenario);

async function logIn(page: Page): Promise<void> {
  await page.goto(demoUrl);
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

test('E2E: add a bag, complete checkout, and review paired behavior claims', async ({ page }, testInfo) => {
  const claimReview = analyzeScenario(pairedScenario);
  expect(pairedScenario.studyNote?.claimProvenance).toContain('not outputs from an LLM');
  expect(pairedScenario.studyNote?.evidenceStatus).toContain('Pending independent evidence review');
  expect(claimReview.pairConsistency.status).toBe('no_pair_disagreement_detected');
  expect(claimReview.claims).toHaveLength(10);

  await testInfo.attach('paired-claim-review.json', {
    body: JSON.stringify({
      scenarioId: claimReview.scenarioId,
      studyNote: pairedScenario.studyNote,
      pairConsistency: claimReview.pairConsistency,
      reviewQueue: claimReview.reviewQueue,
      interpretation: claimReview.interpretation,
    }, null, 2),
    contentType: 'application/json',
  });

  const observations: Record<string, string | boolean> = {};
  await test.step('Log in as the public standard demo user', async () => {
    await logIn(page);
    await expect(page).toHaveURL(/inventory\.html$/);
    await expect(page.getByText('Products', { exact: true })).toBeVisible();
    observations.inventoryUrl = page.url();
    observations.productsHeadingVisible = true;
  });

  await test.step('Add the Sauce Labs Backpack and check the cart', async () => {
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await expect(page.locator('[data-test="remove-sauce-labs-backpack"]')).toBeVisible();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
    await page.locator('.shopping_cart_link').click();
    await expect(page).toHaveURL(/cart\.html$/);
    await expect(page.getByText('Sauce Labs Backpack', { exact: true })).toBeVisible();
    await expect(page.locator('.cart_quantity')).toHaveText('1');
    observations.cartUrl = page.url();
    observations.cartBadge = await page.locator('.shopping_cart_badge').innerText();
    observations.cartItem = await page.getByText('Sauce Labs Backpack', { exact: true }).innerText();
    observations.cartQuantity = await page.locator('.cart_quantity').innerText();
  });

  await test.step('Enter checkout information and review the order', async () => {
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/checkout-step-one\.html$/);
    await page.getByPlaceholder('First Name').fill('Research');
    await page.getByPlaceholder('Last Name').fill('User');
    await page.getByPlaceholder('Zip/Postal Code').fill('12345');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/checkout-step-two\.html$/);
    await expect(page.getByText('Sauce Labs Backpack', { exact: true })).toBeVisible();
    await expect(page.locator('.summary_subtotal_label')).toHaveText('Item total: $29.99');
    await expect(page.locator('.summary_tax_label')).toHaveText('Tax: $2.40');
    await expect(page.locator('.summary_total_label')).toHaveText('Total: $32.39');
    observations.checkoutSummaryUrl = page.url();
    observations.checkoutItem = await page.getByText('Sauce Labs Backpack', { exact: true }).innerText();
    observations.subtotal = await page.locator('.summary_subtotal_label').innerText();
    observations.tax = await page.locator('.summary_tax_label').innerText();
    observations.total = await page.locator('.summary_total_label').innerText();
  });

  await test.step('Finish checkout and observe the confirmation page', async () => {
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(/checkout-complete\.html$/);
    await expect(page.getByText('Thank you for your order!', { exact: true })).toBeVisible();
    observations.confirmationUrl = page.url();
    observations.confirmationText = await page
      .getByText('Thank you for your order!', { exact: true }).innerText();
  });

  await testInfo.attach('playwright-execution-observations-not-ground-truth.json', {
    body: JSON.stringify({
      note: 'These are observations from this Playwright run. They are not treated as independent ground truth by the claim analyzer.',
      observations,
    }, null, 2),
    contentType: 'application/json',
  });
});
