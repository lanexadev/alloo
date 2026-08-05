import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	getMembership,
	requireMembership,
	resolveSystemMessage,
	UserCache,
} from "./helpers";
import { consumeToken, enforceRateLimit } from "./rateLimiter";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_EMOJI_LENGTH = 16;
const TYPING_TTL_MS = 3000;

/** A conversation showing more pinned messages than this is unusable anyway. */
const MAX_PINNED_MESSAGES = 100;

async function getTypingEntry(
	ctx: QueryCtx | MutationCtx,
	conversationId: Id<"conversations">,
	userId: Id<"users">,
) {
	return await ctx.db
		.query("typingIndicators")
		.withIndex("by_conversation_user", (q) =>
			q.eq("conversationId", conversationId).eq("userId", userId),
		)
		.unique();
}

/** True when this user hid the message via "delete for me". */
async function isDeletedFor(
	ctx: QueryCtx | MutationCtx,
	messageId: Id<"messages">,
	userId: Id<"users">,
): Promise<boolean> {
	const deletion = await ctx.db
		.query("messageDeletions")
		.withIndex("by_message_user", (q) =>
			q.eq("messageId", messageId).eq("userId", userId),
		)
		.unique();
	return deletion !== null;
}

/** Reactions for one message, grouped by emoji. */
async function reactionsFor(
	ctx: QueryCtx,
	messageId: Id<"messages">,
	userId: Id<"users">,
) {
	const docs = await ctx.db
		.query("messageReactions")
		.withIndex("by_message", (q) => q.eq("messageId", messageId))
		.collect();

	const groups = new Map<
		string,
		{ emoji: string; count: number; reactedByMe: boolean }
	>();
	for (const r of docs) {
		const group = groups.get(r.emoji) ?? {
			emoji: r.emoji,
			count: 0,
			reactedByMe: false,
		};
		group.count += 1;
		if (r.userId === userId) group.reactedByMe = true;
		groups.set(r.emoji, group);
	}
	return [...groups.values()];
}

/**
 * Paginated conversation history, newest first.
 *
 * Reactive by construction: a new message lands at the top of page 1, so the
 * open page updates without refetching the whole history. Every per-message read
 * below (reactions, deletion flag, reply preview) is therefore bounded by the
 * page size instead of the conversation length.
 *
 * Convex has no multi-key batch read, so those per-message reads stay separate
 * queries — they run in parallel inside a single transaction, and bounding the
 * page is what makes the cost constant.
 */
export const list = query({
	args: {
		conversationId: v.id("conversations"),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			return { page: [], isDone: true, continueCursor: "" };
		}

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) {
			return { page: [], isDone: true, continueCursor: "" };
		}

		// Read receipts need every member's `lastReadAt`; this reads member rows
		// only, never their user documents.
		const members = await ctx.db
			.query("conversationMembers")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.collect();
		const otherMembers = members.filter((m) => m.userId !== userId);

		const result = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.order("desc")
			.paginate(args.paginationOpts);

		const cache = new UserCache(ctx);

		const decorated = await Promise.all(
			result.page.map(async (msg) => {
				if (await isDeletedFor(ctx, msg._id, userId)) return null;

				const isOwn = msg.senderId === userId;

				// Reply preview. The quoted message may itself be hidden for this
				// user — the preview still shows, like in other messengers.
				let replyTo: {
					_id: Id<"messages">;
					content: string;
					senderName: string | null;
					isOwn: boolean;
				} | null = null;
				if (msg.replyToId) {
					const replied = await ctx.db.get(msg.replyToId);
					if (replied) {
						replyTo = {
							_id: replied._id,
							content: replied.content,
							senderName: await cache.displayName(replied.senderId),
							isOwn: replied.senderId === userId,
						};
					}
				}

				return {
					_id: msg._id,
					_creationTime: msg._creationTime,
					conversationId: msg.conversationId,
					senderId: msg.senderId,
					content: msg.content,
					type: msg.type ?? "text",
					pinnedAt: msg.pinnedAt,
					pinnedBy: msg.pinnedBy,
					callData: msg.callData,
					system: msg.systemData
						? await resolveSystemMessage(cache, msg.systemData)
						: null,
					// Legacy system messages stored a pre-rendered French sentence in
					// `content`; it is still rendered for those.
					sender: await cache.get(msg.senderId),
					isOwn,
					isRead:
						isOwn &&
						otherMembers.length > 0 &&
						otherMembers.every(
							(m) => m.lastReadAt != null && m.lastReadAt >= msg._creationTime,
						),
					reactions: await reactionsFor(ctx, msg._id, userId),
					replyTo,
				};
			}),
		);

		return {
			...result,
			page: decorated.filter((m): m is NonNullable<typeof m> => m !== null),
		};
	},
});

export const send = mutation({
	args: {
		conversationId: v.id("conversations"),
		content: v.string(),
		replyToId: v.optional(v.id("messages")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const content = args.content.trim();
		if (!content) throw new Error("Message cannot be empty");
		if (content.length > MAX_MESSAGE_LENGTH) {
			throw new Error("Message too long");
		}

		await requireMembership(ctx, args.conversationId, userId);
		await enforceRateLimit(ctx, "sendMessage", userId);

		if (args.replyToId) {
			const replied = await ctx.db.get(args.replyToId);
			if (!replied || replied.conversationId !== args.conversationId) {
				throw new Error("Replied message not found in this conversation");
			}
		}

		await ctx.db.insert("messages", {
			conversationId: args.conversationId,
			senderId: userId,
			content,
			replyToId: args.replyToId,
		});

		await ctx.db.patch(args.conversationId, { lastMessageAt: Date.now() });

		const typing = await getTypingEntry(ctx, args.conversationId, userId);
		if (typing) await ctx.db.delete(typing._id);
	},
});

async function getAccessibleMessage(
	ctx: QueryCtx | MutationCtx,
	messageId: Id<"messages">,
	userId: Id<"users">,
): Promise<{ message: Doc<"messages">; role: "admin" | "member" }> {
	const message = await ctx.db.get(messageId);
	if (!message) throw new Error("Message not found");
	const membership = await requireMembership(
		ctx,
		message.conversationId,
		userId,
	);
	return { message, role: membership.role };
}

export const toggleReaction = mutation({
	args: { messageId: v.id("messages"), emoji: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");
		const emoji = args.emoji.trim();
		if (!emoji || emoji.length > MAX_EMOJI_LENGTH) {
			throw new Error("Invalid emoji");
		}

		await getAccessibleMessage(ctx, args.messageId, userId);
		await enforceRateLimit(ctx, "toggleReaction", userId);

		// Each user can add several different reactions to a message. The same
		// message/user/emoji tuple remains a toggle, so duplicate reactions cannot
		// be created by repeatedly selecting the same emoji.
		const existing = await ctx.db
			.query("messageReactions")
			.withIndex("by_message_user_emoji", (q) =>
				q
					.eq("messageId", args.messageId)
					.eq("userId", userId)
					.eq("emoji", emoji),
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
			return;
		}

		await ctx.db.insert("messageReactions", {
			messageId: args.messageId,
			userId,
			emoji,
		});
	},
});

export const deleteForMe = mutation({
	args: { messageId: v.id("messages") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const { message } = await getAccessibleMessage(ctx, args.messageId, userId);

		// One row per (message, user) instead of an array on the message, which in a
		// 100-member group would accumulate 100 ids on every single message.
		if (await isDeletedFor(ctx, args.messageId, userId)) return;

		await ctx.db.insert("messageDeletions", {
			messageId: args.messageId,
			userId,
			conversationId: message.conversationId,
		});
	},
});

export const togglePin = mutation({
	args: { messageId: v.id("messages") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const { message, role } = await getAccessibleMessage(
			ctx,
			args.messageId,
			userId,
		);

		if (message.pinnedAt == null) {
			await ctx.db.patch(args.messageId, {
				pinnedAt: Date.now(),
				pinnedBy: userId,
			});
			return;
		}

		// Any member may pin, but unpinning someone else's pin is an admin action.
		// DMs have no admins, so both participants can always unpin there.
		const conversation = await ctx.db.get(message.conversationId);
		const canUnpin =
			message.pinnedBy === userId ||
			role === "admin" ||
			conversation?.type === "dm";
		if (!canUnpin) {
			throw new Error("Only an admin or the member who pinned it can unpin");
		}

		await ctx.db.patch(args.messageId, {
			pinnedAt: undefined,
			pinnedBy: undefined,
		});
	},
});

export const listPinned = query({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) return [];

		// `by_conversation_pinned` is ordered by `pinnedAt`, so this reads pinned
		// messages only instead of the whole conversation.
		const pinned = await ctx.db
			.query("messages")
			.withIndex("by_conversation_pinned", (q) =>
				q.eq("conversationId", args.conversationId).gt("pinnedAt", 0),
			)
			.order("desc")
			.take(MAX_PINNED_MESSAGES);

		const cache = new UserCache(ctx);

		const visible = await Promise.all(
			pinned.map(async (m) => {
				if (m.pinnedAt == null) return null;
				if (await isDeletedFor(ctx, m._id, userId)) return null;
				return {
					_id: m._id,
					content: m.content,
					pinnedAt: m.pinnedAt,
					pinnedBy: m.pinnedBy,
					senderName: await cache.displayName(m.senderId),
					canUnpin: m.pinnedBy === userId || membership.role === "admin",
				};
			}),
		);

		return visible.filter((m): m is NonNullable<typeof m> => m !== null);
	},
});

export const setTyping = mutation({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return;

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) return;

		// Typing pings are fire-and-forget from the client, so an exceeded limit is
		// dropped silently rather than surfaced as a failed keystroke.
		if ((await consumeToken(ctx, "setTyping", userId)) !== null) return;

		const existing = await getTypingEntry(ctx, args.conversationId, userId);
		const expiresAt = Date.now() + TYPING_TTL_MS;

		if (existing) {
			await ctx.db.patch(existing._id, { expiresAt });
		} else {
			await ctx.db.insert("typingIndicators", {
				conversationId: args.conversationId,
				userId,
				expiresAt,
			});
		}
	},
});

export const getTypingUsers = query({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) return [];

		const now = Date.now();
		const indicators = await ctx.db
			.query("typingIndicators")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.collect();

		const cache = new UserCache(ctx);
		const activeTypers = indicators.filter(
			(i) => i.userId !== userId && i.expiresAt > now,
		);

		const names = await Promise.all(
			activeTypers.map((i) => cache.displayName(i.userId)),
		);
		return names.filter((name): name is string => name !== null);
	},
});
