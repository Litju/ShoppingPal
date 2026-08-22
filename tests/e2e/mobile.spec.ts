import { expect, test } from "@playwright/test";

/**
 * Critical mobile flow: browse → product → cart → Shopping Pal bottom sheet →
 * grounded recommendation → agent cart mutation reflected in the cart badge.
 */
test.describe("Shopping Pal mobile flows", () => {
  test("mobile shopping with the assistant sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile viewport flow");
    test.setTimeout(150_000);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();

    /* Browse via the mobile category strip, open a product */
    await page.getByRole("link", { name: "Audio", exact: true }).first().click();
    await expect(page).toHaveURL(/category=audio/);
    await page.locator('[data-testid="product-grid"] a').first().click();

    /* Add to cart from the product page */
    await page.getByRole("button", { name: /^Add .* to cart$/i }).first().click();
    await expect(page.getByTestId("cart-count")).toHaveText("1", { timeout: 15_000 });

    /* Open the Shopping Pal bottom sheet */
    await page.getByTestId("assistant-launcher").click();
    const dialog = page.locator("#pal-mobile-panel");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("log")).toBeVisible();

    /* Ask for a budget recommendation */
    await dialog.locator("#pal-composer").fill("Find me earbuds under $100 for the gym");
    await dialog.locator("#pal-composer").press("Enter");
    await expect(
      dialog.locator("article").filter({ hasText: "Shopping Pal recommends" }),
    ).toBeVisible({ timeout: 30_000 });

    /* Agent adds it; cart badge reflects the mutation */
    const before = Number(await page.getByTestId("cart-count").innerText());
    await dialog.locator("#pal-composer").fill("add it to my cart");
    await dialog.locator("#pal-composer").press("Enter");
    await expect(dialog.getByText("Added to your cart", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("cart-count")).toHaveText(String(before + 1));

    /* Close the sheet; the store is fully usable without chat */
    // Move the pointer off the bottom-centered toaster first: sonner pauses
    // toast timers while hovered, and the full-width mobile toaster would
    // otherwise keep the success toast blocking the close button.
    await page.mouse.move(8, 120);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });
    await page.getByRole("button", { name: "Close Pal" }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Saved items" })).toBeVisible();
  });
});
