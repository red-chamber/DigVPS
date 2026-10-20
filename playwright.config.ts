import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	timeout: 30_000,
	fullyParallel: false,
	use: {
		baseURL: "http://127.0.0.1:4321",
		headless: true,
		trace: "retain-on-failure",
	},
	webServer: {
		command: "corepack pnpm dev --host 127.0.0.1",
		url: "http://127.0.0.1:4321/whiteboards/demo/",
		reuseExistingServer: true,
		timeout: 120_000,
	},
});
