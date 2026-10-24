import { expect, test, type Page } from '@playwright/test';

const demoUrl = 'https://www.saucedemo.com/';
const standardUsername = 'standard_user';
const lockedUsername = 'locked_out_user';
const demoPassword = 'secret_sauce';

async function logIn(page: Page, username: string) {
  await page.goto(demoUrl);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Login' }).click();
}

test('standard user login changes the page to the inventory view', async ({ page }) => {
  await logIn(page, standardUsername);

  await expect(page).toHaveURL(/inventory\.html$/);
  await expect(page.getByText('Products', { exact: true })).toBeVisible();
});

test('adding and removing a product changes the cart contents', async ({ page }) => {
  await logIn(page, standardUsername);
  await expect(page).toHaveURL(/inventory\.html$/);

  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

  await page.locator('.shopping_cart_link').click();
  await expect(page).toHaveURL(/cart\.html$/);
  await expect(page.getByText('Sauce Labs Backpack', { exact: true })).toBeVisible();

  await page.locator('[data-test="remove-sauce-labs-backpack"]').click();
  await expect(page.getByText('Sauce Labs Backpack', { exact: true })).toHaveCount(0);
  await expect(page.locator('.shopping_cart_badge')).toHaveCount(0);
});

test('sorting changes the visible product price order', async ({ page }) => {
  await logIn(page, standardUsername);
  await expect(page).toHaveURL(/inventory\.html$/);

  const prices = page.locator('.inventory_item_price');
  const before = await prices.allTextContents();
  await page.locator('[data-test="product-sort-container"]').selectOption('lohi');
  await expect.poll(async () => prices.allTextContents()).not.toEqual(before);

  const sortedPrices = (await prices.allTextContents()).map((price) =>
    Number(price.replace('$', '')),
  );
  expect(sortedPrices).toEqual([...sortedPrices].sort((left, right) => left - right));
});

test('locked-out user remains on the login page and sees an error', async ({ page }) => {
  await logIn(page, lockedUsername);

  await expect(page).toHaveURL(demoUrl);
  await expect(page.getByText(
    'Epic sadface: Sorry, this user has been locked out.',
  )).toBeVisible();
});
