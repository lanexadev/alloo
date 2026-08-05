import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Per-user token-bucket rate limiting.
 *
 * One row per (user, action) in the `rateLimits` table holds the remaining token
 * count and the timestamp it was last touched. Tokens refill lazily from elapsed
 * time, so there is no cron and no bookkeeping for idle users.
 *
 * Buckets are keyed per user, so contention stays scoped to a single actor: two
 * users sending at the same time never write the same document.
 */

interface Bucket {
	/** Maximum tokens, i.e. the largest allowed burst. */
	capacity: number;
	/** Sustained rate once the burst is spent. */
	refillPerSecond: number;
}

export const RATE_LIMITS = {
	/** ~1 message/s sustained, bursts of 20 (paste-heavy conversations). */
	sendMessage: { capacity: 20, refillPerSecond: 1 },
	/** The client debounces typing pings; this only catches abuse. */
	setTyping: { capacity: 15, refillPerSecond: 2 },
	/** Reactions are cheap but trivially scriptable. */
	toggleReaction: { capacity: 30, refillPerSecond: 2 },
} as const satisfies Record<string, Bucket>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const MS_PER_SECOND = 1000;

/**
 * Consume one token from the caller's bucket.
 *
 * @returns the number of milliseconds to wait when the bucket is empty, or
 *   `null` when the call is allowed.
 */
export async function consumeToken(
	ctx: MutationCtx,
	name: RateLimitName,
	userId: Id<"users">,
): Promise<number | null> {
	const { capacity, refillPerSecond } = RATE_LIMITS[name];
	const key = `${name}:${userId}`;
	const now = Date.now();

	const existing = await ctx.db
		.query("rateLimits")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();

	if (!existing) {
		await ctx.db.insert("rateLimits", {
			key,
			tokens: capacity - 1,
			updatedAt: now,
		});
		return null;
	}

	const elapsedSeconds = Math.max(0, now - existing.updatedAt) / MS_PER_SECOND;
	const tokens = Math.min(
		capacity,
		existing.tokens + elapsedSeconds * refillPerSecond,
	);

	if (tokens < 1) {
		// Do not patch on rejection: a rejected call must not push `updatedAt`
		// forward, which would stall the refill of a client that keeps retrying.
		return Math.ceil(((1 - tokens) / refillPerSecond) * MS_PER_SECOND);
	}

	await ctx.db.patch(existing._id, { tokens: tokens - 1, updatedAt: now });
	return null;
}

/** Consume one token or throw a user-facing error. */
export async function enforceRateLimit(
	ctx: MutationCtx,
	name: RateLimitName,
	userId: Id<"users">,
): Promise<void> {
	const retryAfterMs = await consumeToken(ctx, name, userId);
	if (retryAfterMs !== null) {
		throw new Error(
			`Rate limit exceeded for ${name}. Retry in ${Math.ceil(retryAfterMs / MS_PER_SECOND)}s.`,
		);
	}
}
