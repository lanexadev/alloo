import { describe, expect, it } from "vitest";
import {
	GROUP_WINDOW_MS,
	type GroupableMessage,
	layoutMessages,
} from "./message-groups";

const BASE = new Date("2026-08-05T10:00:00").getTime();

function message(overrides: Partial<GroupableMessage> = {}): GroupableMessage {
	return { senderId: "alice", timestamp: BASE, isPlain: true, ...overrides };
}

describe("layoutMessages", () => {
	it("opens a day and a block on the very first message", () => {
		const [first] = layoutMessages([message()]);

		expect(first).toEqual({
			startsBlock: true,
			endsBlock: true,
			startsDay: true,
		});
	});

	it("merges two close messages from the same sender into one block", () => {
		const layout = layoutMessages([
			message(),
			message({ timestamp: BASE + 30_000 }),
		]);

		expect(layout.map((l) => [l.startsBlock, l.endsBlock])).toEqual([
			[true, false],
			[false, true],
		]);
	});

	it("breaks the block once the sender changes", () => {
		const layout = layoutMessages([
			message(),
			message({ senderId: "bob", timestamp: BASE + 1000 }),
		]);

		expect(layout[1].startsBlock).toBe(true);
	});

	it("breaks the block past the grouping window", () => {
		const layout = layoutMessages([
			message(),
			message({ timestamp: BASE + GROUP_WINDOW_MS + 1 }),
		]);

		expect(layout[1].startsBlock).toBe(true);
	});

	it("keeps a message exactly on the window boundary in the block", () => {
		const layout = layoutMessages([
			message(),
			message({ timestamp: BASE + GROUP_WINDOW_MS }),
		]);

		expect(layout[1].startsBlock).toBe(false);
	});

	it("never merges non-plain entries such as system or call messages", () => {
		const layout = layoutMessages([
			message({ senderId: null, isPlain: false }),
			message({ senderId: null, isPlain: false, timestamp: BASE + 1000 }),
		]);

		expect(layout.every((l) => l.startsBlock && l.endsBlock)).toBe(true);
	});

	it("starts a day when the calendar date changes", () => {
		const nextDay = new Date("2026-08-06T09:00:00").getTime();

		const layout = layoutMessages([message(), message({ timestamp: nextDay })]);

		expect(layout[1].startsDay).toBe(true);
	});

	it("splits a block that straddles midnight even within the window", () => {
		const beforeMidnight = new Date("2026-08-05T23:59:00").getTime();
		const afterMidnight = new Date("2026-08-06T00:01:00").getTime();

		const layout = layoutMessages([
			message({ timestamp: beforeMidnight }),
			message({ timestamp: afterMidnight }),
		]);

		expect(layout[1].startsBlock).toBe(true);
	});
});
