import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	getMembership,
	getUserInfo,
	requireMembership,
	resolveSystemMessage,
	type SystemMessageData,
	UserCache,
} from "./helpers";

const MAX_GROUP_MEMBERS = 100;
const MAX_GROUP_NAME_LENGTH = 100;

/**
 * Unread badges stop being informative past this point, so counting stops too.
 * Bounding the scan is what keeps the sidebar cheap: without it, every new
 * message re-reads the full history of every conversation the user belongs to.
 */
const UNREAD_COUNT_CAP = 99;

/** Invite codes are 128 bits of randomness, valid for this long by default. */
const INVITE_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITE_TTL_DAYS = 365;

/** Documents deleted per pass of the cascade purge, to stay inside transaction limits. */
const PURGE_BATCH_SIZE = 200;

function newInviteCode(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(
	ctx: QueryCtx | MutationCtx,
	conversationId: Id<"conversations">,
	userId: Id<"users">,
	action: string,
): Promise<Doc<"conversationMembers">> {
	const membership = await requireMembership(ctx, conversationId, userId);
	if (membership.role !== "admin") {
		throw new Error(`Only admins can ${action}`);
	}
	return membership;
}

async function listMembers(
	ctx: QueryCtx | MutationCtx,
	conversationId: Id<"conversations">,
): Promise<Doc<"conversationMembers">[]> {
	return await ctx.db
		.query("conversationMembers")
		.withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
		.collect();
}

/**
 * Append a system message.
 *
 * Only the structured payload is stored — no pre-rendered sentence — so the
 * timeline can be re-rendered in any language. `content` stays empty for these.
 */
async function insertSystemMessage(
	ctx: MutationCtx,
	conversationId: Id<"conversations">,
	data: SystemMessageData,
): Promise<void> {
	await ctx.db.insert("messages", {
		conversationId,
		senderId: data.actorId,
		content: "",
		type: "system",
		systemData: data,
	});
	await ctx.db.patch(conversationId, { lastMessageAt: Date.now() });
}

/**
 * Count unread messages, stopping at {@link UNREAD_COUNT_CAP}.
 *
 * `by_conversation` is ordered by `_creationTime`, so the range bound is served
 * by the index: only unread documents are read, never the whole conversation.
 */
async function countUnread(
	ctx: QueryCtx,
	conversationId: Id<"conversations">,
	readSince: number,
): Promise<{ unreadCount: number; hasMoreUnread: boolean }> {
	const unread = await ctx.db
		.query("messages")
		.withIndex("by_conversation", (q) =>
			q.eq("conversationId", conversationId).gt("_creationTime", readSince),
		)
		.take(UNREAD_COUNT_CAP + 1);

	return {
		unreadCount: Math.min(unread.length, UNREAD_COUNT_CAP),
		hasMoreUnread: unread.length > UNREAD_COUNT_CAP,
	};
}

async function lastMessagePreview(
	ctx: QueryCtx,
	cache: UserCache,
	conversationId: Id<"conversations">,
) {
	const message = await ctx.db
		.query("messages")
		.withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
		.order("desc")
		.first();
	if (!message) return null;

	return {
		content: message.content,
		senderId: message.senderId,
		createdAt: message._creationTime,
		type: message.type ?? "text",
		callType: message.callData?.callType ?? null,
		system: message.systemData
			? await resolveSystemMessage(cache, message.systemData)
			: null,
	};
}

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const memberships = await ctx.db
			.query("conversationMembers")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();

		// Shared across conversations: the same people recur in DMs and groups.
		const cache = new UserCache(ctx);

		const conversations = await Promise.all(
			memberships.map(async (membership) => {
				const conversation = await ctx.db.get(membership.conversationId);
				if (!conversation) return null;

				const members = await listMembers(ctx, conversation._id);

				// The sidebar only ever renders the other participant of a DM; groups
				// show a generic icon. Resolving all 100 members of a group here was
				// pure waste.
				const otherMemberId =
					conversation.type === "dm"
						? (members.find((m) => m.userId !== userId)?.userId ?? null)
						: null;
				const otherMember = otherMemberId
					? await cache.get(otherMemberId)
					: null;

				const { unreadCount, hasMoreUnread } = await countUnread(
					ctx,
					conversation._id,
					membership.lastReadAt ?? membership.joinedAt,
				);

				return {
					_id: conversation._id,
					_creationTime: conversation._creationTime,
					type: conversation.type,
					lastMessageAt: conversation.lastMessageAt,
					// Note: `inviteCode` is deliberately not exposed here — it is only
					// needed by the group info panel, which uses `get`.
					displayName:
						conversation.type === "dm"
							? (otherMember?.displayName ??
								otherMember?.username ??
								otherMember?.name ??
								null)
							: (conversation.name ?? null),
					otherMember,
					memberCount: members.length,
					lastMessage: await lastMessagePreview(ctx, cache, conversation._id),
					unreadCount,
					hasMoreUnread,
					role: membership.role,
				};
			}),
		);

		return conversations
			.filter((c): c is NonNullable<typeof c> => c !== null)
			.sort(
				(a, b) =>
					(b.lastMessageAt ?? b._creationTime) -
					(a.lastMessageAt ?? a._creationTime),
			);
	},
});

export const get = query({
	// A raw string, not `v.id`: this id comes straight from the URL, and an
	// argument-validation failure would surface as a hard client error instead of
	// a clean "conversation not found" screen.
	args: { conversationId: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const conversationId = ctx.db.normalizeId(
			"conversations",
			args.conversationId,
		);
		if (!conversationId) return null;

		const membership = await getMembership(ctx, conversationId, userId);
		if (!membership) return null;

		const conversation = await ctx.db.get(conversationId);
		if (!conversation) return null;

		const members = await listMembers(ctx, conversationId);
		const memberUsers = (
			await Promise.all(
				members.map(async (m) => {
					const info = await getUserInfo(ctx, m.userId);
					return info ? { ...info, role: m.role } : null;
				}),
			)
		).filter((m): m is NonNullable<typeof m> => m !== null);

		const otherMember =
			conversation.type === "dm"
				? (memberUsers.find((u) => u._id !== userId) ?? null)
				: null;

		return {
			_id: conversation._id,
			_creationTime: conversation._creationTime,
			type: conversation.type,
			name: conversation.name,
			createdBy: conversation.createdBy,
			lastMessageAt: conversation.lastMessageAt,
			inviteCode: conversation.inviteCode,
			inviteCodeExpiresAt: conversation.inviteCodeExpiresAt,
			displayName:
				conversation.type === "dm"
					? (otherMember?.displayName ??
						otherMember?.username ??
						otherMember?.name ??
						null)
					: (conversation.name ?? null),
			members: memberUsers,
			currentUserRole: membership.role,
		};
	},
});

export const createDM = mutation({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const currentUserId = await getAuthUserId(ctx);
		if (!currentUserId) throw new Error("Not authenticated");

		const targetUser = await ctx.db.get(args.userId);
		if (!targetUser) throw new Error("User not found");

		const myMemberships = await ctx.db
			.query("conversationMembers")
			.withIndex("by_user", (q) => q.eq("userId", currentUserId))
			.collect();

		for (const m of myMemberships) {
			const conv = await ctx.db.get(m.conversationId);
			if (conv?.type !== "dm") continue;

			const otherMember = await getMembership(
				ctx,
				m.conversationId,
				args.userId,
			);
			if (otherMember) return m.conversationId;
		}

		const conversationId = await ctx.db.insert("conversations", {
			type: "dm",
			createdBy: currentUserId,
		});

		const now = Date.now();
		await ctx.db.insert("conversationMembers", {
			conversationId,
			userId: currentUserId,
			role: "member",
			joinedAt: now,
		});
		await ctx.db.insert("conversationMembers", {
			conversationId,
			userId: args.userId,
			role: "member",
			joinedAt: now,
		});

		return conversationId;
	},
});

export const createGroup = mutation({
	args: {
		name: v.string(),
		memberIds: v.optional(v.array(v.id("users"))),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const name = args.name.trim();
		if (!name) throw new Error("Group name is required");
		if (name.length > MAX_GROUP_NAME_LENGTH) {
			throw new Error("Group name too long");
		}

		const initialMemberIds = [...new Set(args.memberIds ?? [])].filter(
			(id) => id !== userId,
		);
		if (initialMemberIds.length + 1 > MAX_GROUP_MEMBERS) {
			throw new Error(`Group is limited to ${MAX_GROUP_MEMBERS} members`);
		}
		for (const memberId of initialMemberIds) {
			const user = await ctx.db.get(memberId);
			if (!user) throw new Error("User not found");
		}

		const now = Date.now();
		const inviteCode = newInviteCode();
		const conversationId = await ctx.db.insert("conversations", {
			type: "group",
			name,
			createdBy: userId,
			inviteCode,
			inviteCodeExpiresAt: now + INVITE_CODE_TTL_MS,
		});

		await ctx.db.insert("conversationMembers", {
			conversationId,
			userId,
			role: "admin",
			joinedAt: now,
		});
		for (const memberId of initialMemberIds) {
			await ctx.db.insert("conversationMembers", {
				conversationId,
				userId: memberId,
				role: "member",
				joinedAt: now,
			});
		}

		await insertSystemMessage(ctx, conversationId, {
			kind: "group_created",
			actorId: userId,
			groupName: name,
		});

		return { conversationId, inviteCode };
	},
});

export const addMembers = mutation({
	args: {
		conversationId: v.id("conversations"),
		userIds: v.array(v.id("users")),
	},
	handler: async (ctx, args) => {
		const currentUserId = await getAuthUserId(ctx);
		if (!currentUserId) throw new Error("Not authenticated");

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) throw new Error("Conversation not found");
		if (conversation.type !== "group") {
			throw new Error("Members can only be added to groups");
		}

		// Adding someone to a private group is as consequential as removing them
		// or renaming it, so it takes the same privilege.
		await requireAdmin(ctx, args.conversationId, currentUserId, "add members");

		const existingMembers = await listMembers(ctx, args.conversationId);
		const existingIds = new Set(existingMembers.map((m) => m.userId));

		const toAdd = [...new Set(args.userIds)].filter(
			(id) => !existingIds.has(id),
		);
		if (existingMembers.length + toAdd.length > MAX_GROUP_MEMBERS) {
			throw new Error(`Group is limited to ${MAX_GROUP_MEMBERS} members`);
		}

		const now = Date.now();
		for (const userId of toAdd) {
			const user = await ctx.db.get(userId);
			if (!user) throw new Error("User not found");
			await ctx.db.insert("conversationMembers", {
				conversationId: args.conversationId,
				userId,
				role: "member",
				joinedAt: now,
			});
		}

		if (toAdd.length > 0) {
			await insertSystemMessage(ctx, args.conversationId, {
				kind: "members_added",
				actorId: currentUserId,
				targetIds: toAdd,
			});
		}

		return toAdd.length;
	},
});

export const renameGroup = mutation({
	args: {
		conversationId: v.id("conversations"),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const newName = args.name.trim();
		if (!newName) throw new Error("Group name is required");
		if (newName.length > MAX_GROUP_NAME_LENGTH) {
			throw new Error("Group name too long");
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) throw new Error("Conversation not found");
		if (conversation.type !== "group") {
			throw new Error("Only groups can be renamed");
		}

		await requireAdmin(ctx, args.conversationId, userId, "rename the group");

		if (newName === conversation.name) return;

		await ctx.db.patch(args.conversationId, { name: newName });
		await insertSystemMessage(ctx, args.conversationId, {
			kind: "group_renamed",
			actorId: userId,
			groupName: newName,
		});
	},
});

export const setMemberRole = mutation({
	args: {
		conversationId: v.id("conversations"),
		userId: v.id("users"),
		role: v.union(v.literal("admin"), v.literal("member")),
	},
	handler: async (ctx, args) => {
		const currentUserId = await getAuthUserId(ctx);
		if (!currentUserId) throw new Error("Not authenticated");

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) throw new Error("Conversation not found");
		if (conversation.type !== "group") {
			throw new Error("Roles only apply to groups");
		}

		await requireAdmin(ctx, args.conversationId, currentUserId, "change roles");

		const targetMembership = await getMembership(
			ctx,
			args.conversationId,
			args.userId,
		);
		if (!targetMembership) throw new Error("User is not a member");
		if (targetMembership.role === args.role) return;

		if (args.role === "member") {
			await assertNotLastAdmin(ctx, args.conversationId);
		}

		await ctx.db.patch(targetMembership._id, { role: args.role });

		await insertSystemMessage(ctx, args.conversationId, {
			kind: args.role === "admin" ? "role_granted" : "role_revoked",
			actorId: currentUserId,
			targetIds: [args.userId],
		});
	},
});

/** A group must always keep at least one admin. */
async function assertNotLastAdmin(
	ctx: MutationCtx,
	conversationId: Id<"conversations">,
): Promise<void> {
	const members = await listMembers(ctx, conversationId);
	const adminCount = members.filter((m) => m.role === "admin").length;
	if (adminCount <= 1) {
		throw new Error("A group must keep at least one admin");
	}
}

export const regenerateInviteCode = mutation({
	args: {
		conversationId: v.id("conversations"),
		expiresInDays: v.optional(v.float64()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) throw new Error("Conversation not found");
		if (conversation.type !== "group") {
			throw new Error("Only groups have invite codes");
		}

		await requireAdmin(
			ctx,
			args.conversationId,
			userId,
			"regenerate the invite link",
		);

		const days = args.expiresInDays;
		if (days !== undefined && (days <= 0 || days > MAX_INVITE_TTL_DAYS)) {
			throw new Error(
				`Invite lifetime must be between 1 and ${MAX_INVITE_TTL_DAYS} days`,
			);
		}

		const ttlMs =
			days === undefined ? INVITE_CODE_TTL_MS : days * 24 * 60 * 60 * 1000;
		const inviteCode = newInviteCode();

		// Rotating the code invalidates every previously shared link.
		await ctx.db.patch(args.conversationId, {
			inviteCode,
			inviteCodeExpiresAt: Date.now() + ttlMs,
		});

		return { inviteCode, inviteCodeExpiresAt: Date.now() + ttlMs };
	},
});

export const joinByInviteCode = mutation({
	args: { inviteCode: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const conversation = await ctx.db
			.query("conversations")
			.withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode))
			.first();

		if (!conversation) throw new Error("Invalid invite code");

		const existing = await getMembership(ctx, conversation._id, userId);
		if (existing) return conversation._id;

		// Groups created before invite expiry existed have no `inviteCodeExpiresAt`
		// and keep working until an admin rotates the code.
		if (
			conversation.inviteCodeExpiresAt != null &&
			conversation.inviteCodeExpiresAt < Date.now()
		) {
			throw new Error("This invite link has expired");
		}

		const members = await listMembers(ctx, conversation._id);
		if (members.length >= MAX_GROUP_MEMBERS) {
			throw new Error(`Group is limited to ${MAX_GROUP_MEMBERS} members`);
		}

		await ctx.db.insert("conversationMembers", {
			conversationId: conversation._id,
			userId,
			role: "member",
			joinedAt: Date.now(),
		});

		await insertSystemMessage(ctx, conversation._id, {
			kind: "member_joined",
			actorId: userId,
		});

		return conversation._id;
	},
});

export const removeMember = mutation({
	args: {
		conversationId: v.id("conversations"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const currentUserId = await getAuthUserId(ctx);
		if (!currentUserId) throw new Error("Not authenticated");

		await requireAdmin(
			ctx,
			args.conversationId,
			currentUserId,
			"remove members",
		);

		// Leaving is a different operation, with its own admin-succession and
		// empty-group handling. Routing self-removal here would bypass both.
		if (args.userId === currentUserId) {
			throw new Error("Use leaveGroup to remove yourself");
		}

		const targetMembership = await getMembership(
			ctx,
			args.conversationId,
			args.userId,
		);
		if (!targetMembership) return;

		if (targetMembership.role === "admin") {
			await assertNotLastAdmin(ctx, args.conversationId);
		}

		await ctx.db.delete(targetMembership._id);
		await insertSystemMessage(ctx, args.conversationId, {
			kind: "member_removed",
			actorId: currentUserId,
			targetIds: [args.userId],
		});
	},
});

export const leaveGroup = mutation({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) return;

		await ctx.db.delete(membership._id);

		const remainingMembers = await listMembers(ctx, args.conversationId);

		if (remainingMembers.length === 0) {
			// Nobody left to read it. Drop the conversation now so it disappears
			// from every list immediately, and let the scheduled purge clear the
			// children (messages, reactions, deletions, typing, calls, signaling)
			// in bounded batches.
			await ctx.db.delete(args.conversationId);
			await ctx.scheduler.runAfter(
				0,
				internal.conversations.purgeConversation,
				{
					conversationId: args.conversationId,
				},
			);
			return;
		}

		await insertSystemMessage(ctx, args.conversationId, {
			kind: "member_left",
			actorId: userId,
		});

		const hasAdmin = remainingMembers.some((m) => m.role === "admin");
		if (membership.role === "admin" && !hasAdmin) {
			// Promote the longest-standing member so the group never loses its admin.
			const nextMember = remainingMembers.reduce((oldest, candidate) =>
				candidate.joinedAt < oldest.joinedAt ? candidate : oldest,
			);
			await ctx.db.patch(nextMember._id, { role: "admin" });
			await insertSystemMessage(ctx, args.conversationId, {
				kind: "admin_promoted",
				actorId: nextMember.userId,
			});
		}
	},
});

export const markAsRead = mutation({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return;

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (membership) {
			await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
		}
	},
});

/**
 * Delete everything that hangs off a conversation, in bounded batches.
 *
 * Reschedules itself until nothing is left, so purging a conversation with tens
 * of thousands of messages cannot blow a single transaction's read/write limits.
 * The conversation document itself is already gone by the time this runs.
 */
export const purgeConversation = internalMutation({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		let budget = PURGE_BATCH_SIZE;

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.take(budget);
		for (const message of messages) {
			const reactions = await ctx.db
				.query("messageReactions")
				.withIndex("by_message", (q) => q.eq("messageId", message._id))
				.collect();
			for (const reaction of reactions) await ctx.db.delete(reaction._id);

			const deletions = await ctx.db
				.query("messageDeletions")
				.withIndex("by_message", (q) => q.eq("messageId", message._id))
				.collect();
			for (const deletion of deletions) await ctx.db.delete(deletion._id);

			await ctx.db.delete(message._id);
		}
		budget -= messages.length;

		if (budget > 0) {
			const typing = await ctx.db
				.query("typingIndicators")
				.withIndex("by_conversation", (q) =>
					q.eq("conversationId", args.conversationId),
				)
				.take(budget);
			for (const entry of typing) await ctx.db.delete(entry._id);
			budget -= typing.length;
		}

		if (budget > 0) {
			const calls = await ctx.db
				.query("calls")
				.withIndex("by_conversation", (q) =>
					q.eq("conversationId", args.conversationId),
				)
				.take(budget);
			for (const call of calls) {
				const participants = await ctx.db
					.query("callParticipants")
					.withIndex("by_call", (q) => q.eq("callId", call._id))
					.collect();
				for (const participant of participants) {
					await ctx.db.delete(participant._id);
				}

				const signals = await ctx.db
					.query("callSignaling")
					.withIndex("by_call_to", (q) => q.eq("callId", call._id))
					.collect();
				for (const signal of signals) await ctx.db.delete(signal._id);

				await ctx.db.delete(call._id);
			}
			budget -= calls.length;
		}

		if (budget > 0) {
			// Defensive: `leaveGroup` removes the last membership before scheduling,
			// but a concurrent join could have slipped one in.
			const members = await listMembers(ctx, args.conversationId);
			for (const member of members.slice(0, budget)) {
				await ctx.db.delete(member._id);
			}
			budget -= Math.min(members.length, budget);
		}

		if (budget <= 0) {
			await ctx.scheduler.runAfter(
				0,
				internal.conversations.purgeConversation,
				{
					conversationId: args.conversationId,
				},
			);
		}
	},
});

/**
 * One-shot backfill: copy legacy `messages.deletedFor` arrays into the
 * `messageDeletions` join table and clear the field. Idempotent, batched.
 *
 * Run from the Convex dashboard once per deployment:
 *   `npx convex run conversations:migrateDeletedFor`
 */
export const migrateDeletedFor = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	handler: async (ctx, args) => {
		// Walk the table with a cursor rather than re-filtering from the start on
		// every pass, which would make the whole migration quadratic.
		const { page, isDone, continueCursor } = await ctx.db
			.query("messages")
			.paginate({ numItems: PURGE_BATCH_SIZE, cursor: args.cursor ?? null });

		const stale = page.filter((m) => m.deletedFor !== undefined);

		for (const message of stale) {
			for (const userId of message.deletedFor ?? []) {
				const existing = await ctx.db
					.query("messageDeletions")
					.withIndex("by_message_user", (q) =>
						q.eq("messageId", message._id).eq("userId", userId),
					)
					.unique();
				if (existing) continue;
				await ctx.db.insert("messageDeletions", {
					messageId: message._id,
					userId,
					conversationId: message.conversationId,
				});
			}
			await ctx.db.patch(message._id, { deletedFor: undefined });
		}

		if (!isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.conversations.migrateDeletedFor,
				{ cursor: continueCursor },
			);
		}

		return { scanned: page.length, migrated: stale.length, isDone };
	},
});
