import { expect, test } from "@playwright/test";

/**
 * Desktop happy path covering the full acceptance sequence:
 * browse → search/filter → product → cart → Shopping Pal agent →
 * recommendation → compare → agent cart mutation → bundle → checkout boundary.
 */
test.describe("Shopping Pal desktop flows", () => {
  test("full shopping journey with the agent", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop viewport flow");
    test.setTimeout(180_000);

    /* 1. Homepage */
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
    await expect(page.getByTestId("home-pal-input")).toBeVisible();

    /* 2. Browse a category */
    await page.goto("/products?category=audio");
    await expect(page.getByTestId("products-heading")).toHaveText("Audio");
    const audioCount = await page.getByTestId("results-count").innerText();
    expect(audioCount).toMatch(/[1-9]/);

    /* 3. Search + filter */
    await page.getByLabel("Search products").fill("headphones");
    await page.getByLabel("Search products").press("Enter");
    await expect(page).toHaveURL(/q=headphones/);
    await page.getByTestId("max-price-input").fill("250");
    await page.getByTestId("max-price-input").press("Tab");
    await expect(page).toHaveURL(/max=250/, { timeout: 15_000 });
    await expect(page.getByTestId("results-count")).toContainText("product");

    /* 4. Open a product */
    await page.locator('[data-testid="product-grid"] a').first().click();
    await expect(page.getByRole("button", { name: /Ask Shopping Pal about this/i })).toBeVisible();

    /* 5. Add product to cart from the PDP */
    await page.getByRole("button", { name: /^Add .* to cart$/i }).first().click();
    await expect(page.getByTestId("cart-count")).toHaveText("1", { timeout: 15_000 });

    /* 6. Update quantity through normal cart UI */
    await page.getByTestId("cart-button").click();
    const drawer = page.getByRole("dialog").filter({ hasText: "Your cart" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await page.keyboard.press("Escape");

    /* 7. Open Shopping Pal (split-screen rail) */
    await page.getByTestId("assistant-launcher-desktop").click();
    await expect(page.getByRole("log", { name: "Shopping Pal conversation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What are you looking for?" }).nth(1)).toBeHidden;

    /* 8+9. Budget request → rendered recommendations */
    await page
      .locator("#pal-composer")
      .fill("Find me the best headphones under $250 for gym and commuting");
    await page.locator("#pal-composer").press("Enter");
    const recommendation = page.getByText("Shopping Pal recommends", { exact: true });
    await expect(recommendation).toBeVisible({ timeout: 30_000 });
    // Grounded price within budget appears on the recommendation card.
    const recCard = page.locator("article").filter({ hasText: "Shopping Pal recommends" });
    await expect(recCard.getByText(/\$\d+/).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Product results" })).toBeVisible();

    /* 10. Compare two named products */
    await page
      .locator("#pal-composer")
      .fill("Compare the Marlowe Sound Pulse ANC Headphones vs Northwind Acoustics Fjord ANC");
    await page.locator("#pal-composer").press("Enter");
    await expect(page.getByText("Side-by-side comparison").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Biggest price gap is", { exact: false }).first()).toBeVisible();

    /* 11. Add a recommended product through Shopping Pal */
    const countBefore = Number(await page.getByTestId("cart-count").innerText());
    await page
      .locator("#pal-composer")
      .fill("Add the second one to my cart");
    await page.locator("#pal-composer").press("Enter");
    await expect(page.getByText("Added to your cart", { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    /* 12. Normal cart UI reflects the agent's mutation */
    await expect(page.getByTestId("cart-count")).toHaveText(String(countBefore + 1));
    await page.goto("/cart");
    await expect(page.getByTestId("cart-heading")).toBeVisible();
    const lineCount = await page.locator("[data-testid^='cart-line-']").count();
    expect(lineCount).toBeGreaterThanOrEqual(2);

    /* 13. Multi-product bundle under a stated budget */
    await page.getByTestId("assistant-launcher-desktop").or(page.getByTestId("assistant-launcher")).first().click();
    await page
      .locator("#pal-composer")
      .fill("Build me the best home gym setup under $1,000");
    await page.locator("#pal-composer").press("Enter");
    const bundle = page.getByText("Curated bundle", { exact: true });
    await expect(bundle).toBeVisible({ timeout: 30_000 });
    const bundleCard = page.locator("article").filter({ hasText: "Curated bundle" });
    await expect(bundleCard.getByText(/Left over|Budget/).first()).toBeVisible();

    /* 14. Prepare checkout through Shopping Pal (explicit user action next) */
    await page
      .locator("#pal-composer")
      .fill("prepare checkout");
    await page.locator("#pal-composer").press("Enter");
    const checkoutCard = page.getByText("Order prepared", { exact: true });
    await expect(checkoutCard).toBeVisible({ timeout: 30_000 });

    /* 15. Complete the clearly-labeled demo checkout boundary */
    await page.getByRole("link", { name: "Complete checkout" }).click();
    await expect(page.getByText("DEMO CHECKOUT", { exact: false })).toBeVisible();
    await expect(page.getByTestId("demo-total")).toContainText("$");
    await page.getByTestId("complete-demo-order").click();
    await expect(page.getByTestId("success-heading")).toHaveText("Order confirmed", {
      timeout: 30_000,
    });
  });

  test("empty search shows a helpful empty state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop viewport flow");
    await page.goto("/products?q=zzzznothing");
    await expect(page.getByText("No products match those filters.").first()).toBeVisible();
  });
});
