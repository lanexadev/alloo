import { describe, expect, it } from "vitest";
import {
	MAX_AVATAR_BYTES,
	normalizeUsername,
	validateAvatarFile,
	validateUsername,
} from "./profile";

function imageOf(bytes: number, type = "image/png"): File {
	return new File([new Uint8Array(bytes)], "avatar.png", { type });
}

describe("normalizeUsername", () => {
	it("lowercases what the user types", () => {
		expect(normalizeUsername("Lucas")).toBe("lucas");
	});

	it("turns spaces into underscores instead of dropping them", () => {
		expect(normalizeUsername("jean pierre")).toBe("jean_pierre");
	});
});

describe("validateUsername", () => {
	it("accepts letters, digits and underscores", () => {
		expect(validateUsername("lucas_02")).toBeNull();
	});

	it("rejects a username below the minimum length", () => {
		expect(validateUsername("ab")).toMatch(/minimum/);
	});

	it("rejects a username above the maximum length", () => {
		expect(validateUsername("a".repeat(21))).toMatch(/maximum/);
	});

	it("rejects punctuation and accents", () => {
		expect(validateUsername("jean-éric")).toMatch(/underscores/);
	});
});

describe("validateAvatarFile", () => {
	it("accepts an image under the size cap", () => {
		expect(validateAvatarFile(imageOf(1024))).toBeNull();
	});

	it("rejects a file that is not an image", () => {
		expect(validateAvatarFile(imageOf(1024, "application/pdf"))).toMatch(
			/image/,
		);
	});

	it("rejects an image past the size cap", () => {
		expect(validateAvatarFile(imageOf(MAX_AVATAR_BYTES + 1))).toMatch(/5 Mo/);
	});
});
