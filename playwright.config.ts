import { defineConfig, devices } from "@playwright/test";
import { APP_URL, LANDING_URL, PLACEHOLDER_CONVEX_URL } from "./e2e/config";

const isCI = !!process.env.CI;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 1 : undefined,
	reporter: isCI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
	webServer: [
		{
			command:
				"bun run --cwd apps/landing build && bun run --cwd apps/landing start",
			url: LANDING_URL,
			// Always start our own: a reused dev server would run with different
			// NEXT_PUBLIC_* values and add HMR noise to the console assertions.
			reuseExistingServer: false,
			timeout: 180_000,
			stdout: "pipe",
			env: {
				NEXT_PUBLIC_APP_URL: APP_URL,
			},
		},
		{
			command: "bun run --cwd apps/app build && bun run --cwd apps/app start",
			url: `${APP_URL}/login`,
			// Always start our own: a reused dev server would run with different
			// NEXT_PUBLIC_* values and add HMR noise to the console assertions.
			reuseExistingServer: false,
			timeout: 180_000,
			stdout: "pipe",
			env: {
				NEXT_PUBLIC_CONVEX_URL: PLACEHOLDER_CONVEX_URL,
			},
		},
	],
});
