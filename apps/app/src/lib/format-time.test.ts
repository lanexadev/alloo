import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	formatDateSeparator,
	formatExpiry,
	formatLastSeen,
	formatMessageTime,
	isNewDay,
} from "./format-time";

const NOW = new Date("2026-08-05T12:00:00Z").getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatLastSeen", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("says never for a user who was never seen", () => {
		expect(formatLastSeen(undefined)).toBe("Jamais vu");
	});

	it("treats the last minute as being online", () => {
		expect(formatLastSeen(NOW - 30 * 1000)).toBe("En ligne");
	});

	it("counts in minutes within the hour", () => {
		expect(formatLastSeen(NOW - 5 * MINUTE)).toBe("Vu il y a 5min");
	});

	it("counts in hours within the day", () => {
		expect(formatLastSeen(NOW - 3 * HOUR)).toBe("Vu il y a 3h");
	});

	it("says yesterday exactly one day back", () => {
		expect(formatLastSeen(NOW - DAY)).toBe("Vu hier");
	});

	it("counts in days within the week", () => {
		expect(formatLastSeen(NOW - 3 * DAY)).toBe("Vu il y a 3j");
	});

	it("falls back to a date beyond a week", () => {
		expect(formatLastSeen(NOW - 30 * DAY)).toMatch(/\d/);
	});
});

describe("formatMessageTime", () => {
	it("renders hours and minutes zero-padded", () => {
		const timestamp = new Date("2026-08-05T09:05:00").getTime();

		expect(formatMessageTime(timestamp)).toBe("09:05");
	});
});

describe("formatDateSeparator", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-05T12:00:00"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("names the current calendar day", () => {
		expect(formatDateSeparator(new Date("2026-08-05T00:10:00").getTime())).toBe(
			"Aujourd'hui",
		);
	});

	it("names the previous calendar day", () => {
		expect(formatDateSeparator(new Date("2026-08-04T23:50:00").getTime())).toBe(
			"Hier",
		);
	});

	it("spells out the weekday earlier in the same year", () => {
		expect(formatDateSeparator(new Date("2026-07-20T10:00:00").getTime())).toBe(
			"lundi 20 juillet",
		);
	});

	it("adds the year once the date leaves the current one", () => {
		expect(formatDateSeparator(new Date("2025-12-24T10:00:00").getTime())).toBe(
			"24 décembre 2025",
		);
	});
});

describe("isNewDay", () => {
	it("sees two timestamps on the same day as one day", () => {
		const morning = new Date("2026-08-05T08:00:00").getTime();
		const evening = new Date("2026-08-05T23:00:00").getTime();

		expect(isNewDay(morning, evening)).toBe(false);
	});

	it("sees a two-minute gap across midnight as a new day", () => {
		const before = new Date("2026-08-05T23:59:00").getTime();
		const after = new Date("2026-08-06T00:01:00").getTime();

		expect(isNewDay(before, after)).toBe(true);
	});
});

describe("formatExpiry", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("says a link without expiry never expires", () => {
		expect(formatExpiry(undefined)).toBe("n'expire pas");
	});

	it("says a past date already expired", () => {
		expect(formatExpiry(NOW - 1)).toBe("expiré");
	});

	it("treats the exact expiry instant as expired", () => {
		expect(formatExpiry(NOW)).toBe("expiré");
	});

	it("spells out the date and time of a future expiry", () => {
		expect(formatExpiry(NOW + 7 * DAY)).toMatch(/^expire le .+ à \d{2}:\d{2}$/);
	});
});
