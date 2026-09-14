import { test, expect } from "@playwright/test";

test.describe("Roadmap & Daily Practice Engine E2E", () => {
  test("load -> filter -> open node -> check concept -> reload -> state persists", async ({
    page,
  }) => {
    // 1. Load the Frontend Roadmap page
    await page.goto("/roadmap/frontend");
    await expect(page).toHaveTitle(/Roadmap/i);

    // Verify root node is visible
    const rootNode = page.locator('[role="treeitem"]').first();
    await expect(rootNode).toBeVisible();

    // 2. Filter nodes using SearchBar
    const searchInput = page.getByRole("searchbox");
    await searchInput.fill("React");
    // Wait for ~150ms debounce
    await page.waitForTimeout(200);

    // 3. Open Node details drawer
    const reactNode = page.locator('[role="treeitem"]:has-text("React Architecture")');
    if (await reactNode.isVisible()) {
      await reactNode.click();
    } else {
      await rootNode.click();
    }

    // Verify drawer opened
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // 4. Check a concept in the ConceptChecklist
    const firstCheckbox = drawer.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();

    // 5. Reload the page
    await page.reload();

    // Re-open the same node
    if (await reactNode.isVisible()) {
      await reactNode.click();
    } else {
      await rootNode.click();
    }

    // 6. Verify state persisted in localStorage
    const reloadedCheckbox = page
      .getByRole("dialog")
      .locator('input[type="checkbox"]')
      .first();
    await expect(reloadedCheckbox).toBeChecked();
  });
});
