import { isNewDay } from "./format-time";

/**
 * Consecutive messages from the same sender collapse into one visual block as
 * long as they stay inside this window. Beyond it the conversation has moved
 * on, and a fresh block (avatar, tail, timestamp) reads more truthfully.
 */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** The minimum a message must expose for the list to lay it out. */
export interface GroupableMessage {
	/** `null` for system entries, which never join a block. */
	senderId: string | null;
	timestamp: number;
	/** Anything other than a plain message breaks the block it lands in. */
	isPlain: boolean;
}

export interface MessageLayout {
	/** First message of its block — carries the sender name. */
	startsBlock: boolean;
	/** Last message of its block — carries the tail, avatar and timestamp. */
	endsBlock: boolean;
	/** A day divider belongs above this message. */
	startsDay: boolean;
}

function joinsPrevious(
	current: GroupableMessage,
	previous: GroupableMessage | undefined,
): boolean {
	if (!previous) return false;
	if (!current.isPlain || !previous.isPlain) return false;
	if (current.senderId === null || current.senderId !== previous.senderId) {
		return false;
	}
	if (isNewDay(previous.timestamp, current.timestamp)) return false;
	return current.timestamp - previous.timestamp <= GROUP_WINDOW_MS;
}

/**
 * Turns a chronological message list into per-message layout flags: where
 * blocks open and close, and where a new day starts. Pure so the visual
 * grouping rules can be exercised without rendering a conversation.
 */
export function layoutMessages(
	messages: readonly GroupableMessage[],
): MessageLayout[] {
	return messages.map((message, index) => {
		const previous = messages[index - 1];
		const next = messages[index + 1];

		return {
			startsBlock: !joinsPrevious(message, previous),
			endsBlock: !(next && joinsPrevious(next, message)),
			startsDay:
				previous === undefined ||
				isNewDay(previous.timestamp, message.timestamp),
		};
	});
}
