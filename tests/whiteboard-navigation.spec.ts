import { expect, test } from "@playwright/test";

const board = {
	id: "layout-test",
	slug: "layout-test",
	title: "Layout test",
	description: "A board used to verify layout navigation.",
	category: "Whiteboard",
	tags: [],
	revision: 1,
	createdAt: 1,
	updatedAt: 1,
	canEdit: true,
};

test("loads the full-screen editor layout from the whiteboard directory", async ({
	page,
}) => {
	await page.route("**/api/whiteboards", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ boards: [board], canCreate: true }),
		});
	});
	await page.goto("/whiteboards/");
	await page.getByRole("link", { name: "Open editor" }).click();

	await expect(page.locator(".canvas-shell")).toHaveCount(1);
	await expect(page.locator(".canvas-editor")).toHaveCount(1);
	await expect(page.locator("#main-grid")).toHaveCount(0);
});

test("restores the site layout when leaving the whiteboard editor", async ({
	page,
}) => {
	await page.goto("/whiteboards/demo/");
	await page.locator(".canvas-editor .brand").click();

	await expect(page.locator("#main-grid")).toHaveCount(1);
	await expect(page.locator(".directory")).toHaveCount(1);
	await expect(page.locator(".canvas-shell")).toHaveCount(0);
});
