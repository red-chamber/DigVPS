import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem("canvas-test-initialized")) {
			localStorage.clear();
			sessionStorage.setItem("canvas-test-initialized", "1");
		}
	});
	await page.goto("/whiteboards/demo/");
	await expect(page.locator(".canvas-node")).toHaveCount(2);
});

test("creates, edits, saves, reloads, undoes and redoes a node", async ({
	page,
}) => {
	await page.getByRole("button", { name: "Add text" }).click();
	await expect(page.locator(".canvas-node")).toHaveCount(3);
	const editor = page.locator(".canvas-node.selected textarea");
	await editor.fill("A persistent thought");
	await page.getByRole("button", { name: "Select" }).click();
	await expect(page.getByText("A persistent thought")).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => localStorage.getItem("cedrian-canvas:local-demo")),
		)
		.toContain("A persistent thought");
	await page.reload();
	await expect(page.getByText("A persistent thought")).toBeVisible();
	await page
		.locator(".canvas-node", { hasText: "A persistent thought" })
		.click();
	await page.keyboard.press("Delete");
	await expect(page.getByText("A persistent thought")).toHaveCount(0);
	await page.keyboard.press("Control+z");
	await expect(page.getByText("A persistent thought")).toBeVisible();
	await page.keyboard.press("Control+y");
	await expect(page.getByText("A persistent thought")).toHaveCount(0);
});

test("sanitizes untrusted Markdown and supports the command palette", async ({
	page,
}) => {
	await page.locator(".canvas-node", { hasText: "Welcome" }).dblclick();
	const editor = page.locator(".canvas-node textarea");
	await editor.fill(
		"<img src=x onerror=window.__canvasXss=1>\n\n```python\nprint('safe')\n```",
	);
	await page.getByRole("button", { name: "Select" }).click();
	await expect(page.locator(".canvas-node .hljs-built_in")).toHaveText("print");
	await expect(page.locator('.canvas-node img[src="x"]')).toHaveCount(0);
	expect(
		await page.evaluate(
			() => (window as Window & { __canvasXss?: number }).__canvasXss,
		),
	).toBeUndefined();
	await page.keyboard.press("Control+k");
	await expect(
		page.getByRole("dialog", { name: "Command palette" }),
	).toBeVisible();
	await page.getByLabel("Search commands").fill("fit all");
	await page.getByRole("button", { name: "Fit all content" }).click();
});

test("virtualizes the 500-node performance canvas", async ({ page }) => {
	await page.goto("/whiteboards/performance/?nodes=500");
	await expect(page.getByText(/500 nodes · 700 edges/u)).toBeVisible();
	await expect(page.locator(".canvas-node").first()).toBeVisible();
	const rendered = await page.locator(".canvas-node").count();
	expect(rendered).toBeGreaterThan(0);
	expect(rendered).toBeLessThan(500);
});

test("keeps the 1000-node, 1500-edge stress canvas browsable", async ({
	page,
}) => {
	await page.goto("/whiteboards/performance/");
	await expect(
		page.getByText(/1000 nodes · 1500 edges · \d+ FPS/u),
	).toBeVisible({
		timeout: 5000,
	});
	const rendered = await page.locator(".canvas-node").count();
	expect(rendered).toBeGreaterThan(0);
	expect(rendered).toBeLessThan(250);
});
