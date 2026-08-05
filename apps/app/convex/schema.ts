import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Structured payload for system messages, rendered client-side (see src/lib/system-message.ts). */
const systemData = v.object({
	kind: v.union(
		v.literal("group_created"),
		v.literal("group_renamed"),
		v.literal("members_added"),
		v.literal("member_removed"),
		v.literal("member_joined"),
		v.literal("member_left"),
		v.literal("role_granted"),
		v.literal("role_revoked"),
		v.literal("admin_promoted"),
	),
	actorId: v.id("users"),
	targetIds: v.optional(v.array(v.id("users"))),
	groupName: v.optional(v.string()),
});

export default defineSchema({
	...authTables,

	users: defineTable({
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		username: v.optional(v.string()),
		displayName: v.optional(v.string()),
		bio: v.optional(v.string()),
		image: v.optional(v.string()),
		emailVerificationTime: v.optional(v.float64()),
		isOnline: v.optional(v.boolean()),
		lastSeenAt: v.optional(v.float64()),
		onboardingCompleted: v.optional(v.boolean()),
	})
		.index("by_username", ["username"])
		.index("by_email", ["email"])
		// Full-text index so user search never scans the table.
		.searchIndex("search_username", {
			searchField: "username",
		}),

	conversations: defineTable({
		type: v.union(v.literal("dm"), v.literal("group")),
		name: v.optional(v.string()),
		createdBy: v.id("users"),
		lastMessageAt: v.optional(v.float64()),
		inviteCode: v.optional(v.string()),
		/** Absolute expiry of `inviteCode`. Undefined means the code never expires. */
		inviteCodeExpiresAt: v.optional(v.float64()),
	})
		.index("by_lastMessageAt", ["lastMessageAt"])
		.index("by_inviteCode", ["inviteCode"]),

	conversationMembers: defineTable({
		conversationId: v.id("conversations"),
		userId: v.id("users"),
		role: v.union(v.literal("admin"), v.literal("member")),
		joinedAt: v.float64(),
		lastReadAt: v.optional(v.float64()),
	})
		.index("by_conversation", ["conversationId"])
		.index("by_user", ["userId"])
		.index("by_conversation_user", ["conversationId", "userId"]),

	messages: defineTable({
		conversationId: v.id("conversations"),
		senderId: v.id("users"),
		content: v.string(),
		replyToId: v.optional(v.id("messages")),
		pinnedAt: v.optional(v.float64()),
		pinnedBy: v.optional(v.id("users")),
		/**
		 * @deprecated Superseded by the `messageDeletions` join table, which does not
		 * grow the message document with one id per group member. Kept so documents
		 * written before the migration still validate; never read, never written.
		 */
		deletedFor: v.optional(v.array(v.id("users"))),
		type: v.optional(
			v.union(v.literal("text"), v.literal("call"), v.literal("system")),
		),
		systemData: v.optional(systemData),
		callData: v.optional(
			v.object({
				callId: v.id("calls"),
				callType: v.union(v.literal("audio"), v.literal("video")),
				status: v.union(
					v.literal("ended"),
					v.literal("missed"),
					v.literal("declined"),
				),
				duration: v.optional(v.float64()),
			}),
		),
	})
		.index("by_conversation", ["conversationId"])
		// Lets `listPinned` read only pinned messages instead of the whole history.
		.index("by_conversation_pinned", ["conversationId", "pinnedAt"]),

	/** One row per (message, user) hidden via "delete for me". */
	messageDeletions: defineTable({
		messageId: v.id("messages"),
		userId: v.id("users"),
		conversationId: v.id("conversations"),
	})
		.index("by_message", ["messageId"])
		.index("by_message_user", ["messageId", "userId"])
		.index("by_conversation_user", ["conversationId", "userId"]),

	messageReactions: defineTable({
		messageId: v.id("messages"),
		userId: v.id("users"),
		emoji: v.string(),
	})
		.index("by_message", ["messageId"])
		.index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

	typingIndicators: defineTable({
		conversationId: v.id("conversations"),
		userId: v.id("users"),
		expiresAt: v.float64(),
	})
		.index("by_conversation", ["conversationId"])
		.index("by_conversation_user", ["conversationId", "userId"]),

	/** Token buckets backing the per-user rate limits (see convex/rateLimiter.ts). */
	rateLimits: defineTable({
		key: v.string(),
		tokens: v.float64(),
		updatedAt: v.float64(),
	}).index("by_key", ["key"]),

	calls: defineTable({
		conversationId: v.id("conversations"),
		initiatorId: v.id("users"),
		type: v.union(v.literal("audio"), v.literal("video")),
		status: v.union(
			v.literal("ringing"),
			v.literal("active"),
			v.literal("ended"),
			v.literal("missed"),
			v.literal("declined"),
		),
		startedAt: v.optional(v.float64()),
		endedAt: v.optional(v.float64()),
		duration: v.optional(v.float64()),
	})
		.index("by_conversation", ["conversationId"])
		.index("by_status", ["status"]),

	callParticipants: defineTable({
		callId: v.id("calls"),
		userId: v.id("users"),
		status: v.union(
			v.literal("ringing"),
			v.literal("joined"),
			v.literal("left"),
			v.literal("declined"),
			v.literal("missed"),
		),
		joinedAt: v.optional(v.float64()),
		leftAt: v.optional(v.float64()),
		isMuted: v.boolean(),
		isCameraOff: v.boolean(),
		isScreenSharing: v.boolean(),
	})
		.index("by_call", ["callId"])
		.index("by_user", ["userId"])
		.index("by_call_user", ["callId", "userId"]),

	callSignaling: defineTable({
		callId: v.id("calls"),
		fromUserId: v.id("users"),
		toUserId: v.id("users"),
		type: v.union(
			v.literal("offer"),
			v.literal("answer"),
			v.literal("ice-candidate"),
		),
		payload: v.string(),
		consumed: v.boolean(),
	}).index("by_call_to", ["callId", "toUserId", "consumed"]),
});
