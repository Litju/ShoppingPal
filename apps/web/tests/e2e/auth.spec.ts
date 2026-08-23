import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test.describe("Medusa Auth", () => {
  test("registers, preserves a guest cart, logs out, and signs back in", async ({ page }, testInfo) => {
    test.skip(!process.env.MEDUSA_BACKEND_URL, "Medusa Auth flow");
    test.skip(testInfo.project.name !== "desktop-chromium", "Single auth flow");
    test.setTimeout(90_000);

    const email = `gate-d-${randomUUID()}@example.test`;
    const password = "ShoppingPalGateD!2026";

    await page.goto("/products/marlowe-pulse-anc-headphones");
    await page.getByRole("button", { name: /^Add .* to cart$/i }).first().click();
    await expect(page.getByTestId("cart-count")).toHaveText("1", { timeout: 15_000 });

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Gate D Shopper");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByText("Marlowe Sound Pulse ANC Headphones", { exact: true })).toBeVisible();

    const signOutStatus = await page.evaluate(async () =>
      (await fetch("/api/auth/sign-out", { method: "POST" })).status,
    );
    expect(signOutStatus).toBe(200);
    await page.goto("/account");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByTestId("sign-in-form").getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
    await page.goto("/cart");
    await expect(page.getByText("Marlowe Sound Pulse ANC Headphones", { exact: true })).toBeVisible();
  });
});
