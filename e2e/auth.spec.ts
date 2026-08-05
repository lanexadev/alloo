import { expect, test } from "@playwright/test";
import { APP_URL } from "./config";

test.describe("public app routes", () => {
	test("sends a signed-out visitor to the login page", async ({ page }) => {
		await page.goto(APP_URL);

		await expect(page).toHaveURL(`${APP_URL}/login`);
	});

	test("asks for an email and a password", async ({ page }) => {
		await page.goto(`${APP_URL}/login`);

		await expect(page.getByPlaceholder("Email")).toBeVisible();
		await expect(page.getByPlaceholder("Mot de passe")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Se connecter" }),
		).toBeVisible();
	});

	test("offers the OAuth providers", async ({ page }) => {
		await page.goto(`${APP_URL}/login`);

		await expect(
			page.getByRole("button", { name: "Continuer avec Google" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Continuer avec GitHub" }),
		).toBeVisible();
	});

	test("refuses to submit an empty form", async ({ page }) => {
		await page.goto(`${APP_URL}/login`);

		await page.getByRole("button", { name: "Se connecter" }).click();

		// Native constraint validation keeps the user on the page.
		await expect(page).toHaveURL(`${APP_URL}/login`);
		await expect(page.getByPlaceholder("Email")).toBeFocused();
	});

	test("walks from login to signup and back", async ({ page }) => {
		await page.goto(`${APP_URL}/login`);

		await page.getByRole("link", { name: "S'inscrire" }).click();
		await expect(page).toHaveURL(`${APP_URL}/signup`);

		await page.getByRole("link", { name: "Se connecter" }).click();
		await expect(page).toHaveURL(`${APP_URL}/login`);
	});

	test("keeps a signed-out visitor out of the chat", async ({ page }) => {
		await page.goto(`${APP_URL}/chat`);

		await expect(page).toHaveURL(`${APP_URL}/login`);
	});
});

test.describe("installable web app", () => {
	test("serves a manifest describing Alloo", async ({ request }) => {
		const response = await request.get(`${APP_URL}/manifest.webmanifest`);

		expect(response.ok()).toBe(true);
		const manifest = await response.json();
		expect(manifest).toMatchObject({
			short_name: "Alloo",
			display: "standalone",
			start_url: "/chat",
		});
	});

	test("ships the icons the manifest points at", async ({ request }) => {
		const manifest = await (
			await request.get(`${APP_URL}/manifest.webmanifest`)
		).json();

		for (const icon of manifest.icons) {
			const response = await request.get(`${APP_URL}${icon.src}`);
			expect(response.ok(), `${icon.src} is served`).toBe(true);
			expect(response.headers()["content-type"]).toContain("svg");
		}
	});

	test("links the manifest from the document head", async ({ page }) => {
		await page.goto(`${APP_URL}/login`);

		await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
	});
});
