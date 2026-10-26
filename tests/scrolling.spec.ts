import { expect, test } from "@playwright/test";

for (const path of ["/", "/notes/", "/about/", "/account/"]) {
	test(`allows vertical scrolling on ${path}`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 500 });
		await page.goto(path);
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollHeight > window.innerHeight,
				),
			)
			.toBe(true);

		await page.mouse.wheel(0, 600);
		await expect
			.poll(() => page.evaluate(() => window.scrollY))
			.toBeGreaterThan(0);
	});
}

test("allows vertical scrolling on narrow authentication pages", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 400 });
	await page.goto("/register/");
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollHeight > window.innerHeight,
			),
		)
		.toBe(true);

	await page.mouse.wheel(0, 500);
	await expect
		.poll(() => page.evaluate(() => window.scrollY))
		.toBeGreaterThan(0);
});
