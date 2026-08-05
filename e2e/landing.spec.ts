import { expect, test } from "@playwright/test";
import { APP_URL, LANDING_URL } from "./config";

test.describe("landing page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(LANDING_URL);
	});

	test("leads with the product promise", async ({ page }) => {
		await expect(page.getByRole("heading", { level: 1 })).toContainText(
			"Juste discuter.",
		);
	});

	test("sends visitors to the app", async ({ page }) => {
		const cta = page.getByRole("link", { name: "Ouvrir Alloo" });

		await expect(cta).toHaveAttribute("href", APP_URL);
	});

	test("links to the source repository", async ({ page }) => {
		await expect(
			page.getByRole("link", { name: "Voir le code" }),
		).toHaveAttribute("href", /github\.com/);
	});

	test("presents the three things Alloo does", async ({ page }) => {
		const pillars = page.getByRole("heading", { level: 2 });

		await expect(pillars).toHaveText([
			"Messages privés",
			"Groupes",
			"Dans le navigateur",
		]);
	});

	test("shows a preview of a conversation", async ({ page }) => {
		const preview = page.getByRole("region", {
			name: "Aperçu de l'application",
		});

		await expect(preview).toBeVisible();
		await expect(preview.getByRole("listitem")).toHaveCount(3);
	});

	test("declares itself in French", async ({ page }) => {
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page).toHaveTitle(/Alloo/);
	});

	test("never scrolls sideways", async ({ page }) => {
		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth,
		);

		expect(overflows).toBe(false);
	});

	test("renders without console errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error") errors.push(message.text());
		});

		await page.reload();

		expect(errors).toEqual([]);
	});
});
