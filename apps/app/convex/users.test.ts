import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { asUser, seedUser, setupTest } from "./test.setup";

describe("users.updateProfile", () => {
	it("saves the username, display name and bio", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "placeholder");

		await asUser(t, userId).mutation(api.users.updateProfile, {
			username: "camille",
			displayName: "Camille",
			bio: "Bonjour",
		});

		const user = await asUser(t, userId).query(api.users.currentUser, {});
		expect(user).toMatchObject({
			username: "camille",
			displayName: "Camille",
			bio: "Bonjour",
		});
	});

	it("rejects a username shorter than 3 characters", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "placeholder");

		await expect(
			asUser(t, userId).mutation(api.users.updateProfile, { username: "ab" }),
		).rejects.toThrow(/3-20 characters/);
	});

	it("rejects a username longer than 20 characters", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "placeholder");

		await expect(
			asUser(t, userId).mutation(api.users.updateProfile, {
				username: "a".repeat(21),
			}),
		).rejects.toThrow(/3-20 characters/);
	});

	it("rejects a username containing anything but letters, digits and underscores", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "placeholder");

		await expect(
			asUser(t, userId).mutation(api.users.updateProfile, {
				username: "cam ille",
			}),
		).rejects.toThrow(/letters, numbers, and underscores/);
	});

	it("rejects a bio longer than 160 characters", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "placeholder");

		await expect(
			asUser(t, userId).mutation(api.users.updateProfile, {
				username: "camille",
				bio: "a".repeat(161),
			}),
		).rejects.toThrow(/160 characters/);
	});

	it("rejects a username already taken by someone else", async () => {
		const t = setupTest();
		const taken = await seedUser(t, "camille");
		const other = await seedUser(t, "placeholder");

		await expect(
			asUser(t, other).mutation(api.users.updateProfile, {
				username: "camille",
			}),
		).rejects.toThrow(/already taken/);
		expect(taken).toBeDefined();
	});

	it("lets a user keep their own username", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "camille");

		await expect(
			asUser(t, userId).mutation(api.users.updateProfile, {
				username: "camille",
				bio: "Mise à jour",
			}),
		).resolves.not.toThrow();
	});

	it("rejects an unauthenticated caller", async () => {
		const t = setupTest();

		await expect(
			t.mutation(api.users.updateProfile, { username: "camille" }),
		).rejects.toThrow(/Not authenticated/);
	});
});

describe("users.currentUser", () => {
	it("returns null when nobody is signed in", async () => {
		const t = setupTest();

		expect(await t.query(api.users.currentUser, {})).toBeNull();
	});
});

describe("users.completeOnboarding", () => {
	it("flags onboarding as completed", async () => {
		const t = setupTest();
		const userId = await t.run(async (ctx) =>
			ctx.db.insert("users", { username: "camille" }),
		);

		await asUser(t, userId).mutation(api.users.completeOnboarding, {});

		const user = await asUser(t, userId).query(api.users.currentUser, {});
		expect(user?.onboardingCompleted).toBe(true);
	});
});

describe("users.setOnlineStatus", () => {
	it("records the online flag and refreshes lastSeenAt", async () => {
		const t = setupTest();
		const userId = await seedUser(t, "camille");

		await asUser(t, userId).mutation(api.users.setOnlineStatus, {
			isOnline: true,
		});

		const user = await asUser(t, userId).query(api.users.currentUser, {});
		expect(user?.isOnline).toBe(true);
		expect(user?.lastSeenAt).toBeTypeOf("number");
	});
});

describe("users.searchUsers", () => {
	it("finds users whose username contains the query, case-insensitively", async () => {
		const t = setupTest();
		const me = await seedUser(t, "lucas");
		await seedUser(t, "camille");

		const results = await asUser(t, me).query(api.users.searchUsers, {
			query: "CAM",
		});

		expect(results.map((u) => u.username)).toEqual(["camille"]);
	});

	it("never returns the caller", async () => {
		const t = setupTest();
		const me = await seedUser(t, "camille");

		const results = await asUser(t, me).query(api.users.searchUsers, {
			query: "camille",
		});

		expect(results).toEqual([]);
	});

	it("returns nothing for a query shorter than 2 characters", async () => {
		const t = setupTest();
		const me = await seedUser(t, "lucas");
		await seedUser(t, "camille");

		const results = await asUser(t, me).query(api.users.searchUsers, {
			query: "c",
		});

		expect(results).toEqual([]);
	});

	it("returns nothing when nobody is signed in", async () => {
		const t = setupTest();
		await seedUser(t, "camille");

		expect(await t.query(api.users.searchUsers, { query: "camille" })).toEqual(
			[],
		);
	});

	it("caps the result list at 10 users", async () => {
		const t = setupTest();
		const me = await seedUser(t, "lucas");
		for (let i = 0; i < 12; i++) {
			await seedUser(t, `camille${i}`);
		}

		const results = await asUser(t, me).query(api.users.searchUsers, {
			query: "camille",
		});

		expect(results).toHaveLength(10);
	});
});
