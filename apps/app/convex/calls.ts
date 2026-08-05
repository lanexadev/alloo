import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { getMembership, toPublicUser } from "./helpers";

/**
 * 1:1 call system (DM only).
 *
 * Lifecycle: ringing -> active -> ended | missed | declined
 *   - initiate: caller creates the call, becomes `joined`, callee is `ringing`.
 *   - accept:   callee -> `joined`, call -> `active`.
 *   - decline:  callee -> `declined`, call -> `declined`.
 *   - hangup:   either party ends an `active` call -> `ended`; caller cancelling a
 *               `ringing` call -> `missed` (callee missed it).
 *   - timeout:  caller marks an unanswered `ringing` call as `missed`.
 *
 * Signaling (WebRTC) rides Convex reactive queries. Every signal is addressed to
 * the single peer, ownership-checked on both send and consume, and deleted once
 * consumed so the table never grows.
 */

// Max SDP / ICE payload size. A full SDP with candidates is a few KB; 100KB is a
// generous ceiling that still rejects abuse.
const MAX_SIGNAL_PAYLOAD = 100_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("Not authenticated");
	return userId;
}

async function getParticipant(
	ctx: QueryCtx | MutationCtx,
	callId: Id<"calls">,
	userId: Id<"users">,
) {
	return await ctx.db
		.query("callParticipants")
		.withIndex("by_call_user", (q) =>
			q.eq("callId", callId).eq("userId", userId),
		)
		.unique();
}

async function getCallParticipants(
	ctx: QueryCtx | MutationCtx,
	callId: Id<"calls">,
) {
	return await ctx.db
		.query("callParticipants")
		.withIndex("by_call", (q) => q.eq("callId", callId))
		.collect();
}

/** Idempotent terminal transition + system message insertion. */
async function endCall(
	ctx: MutationCtx,
	call: Doc<"calls">,
	status: "ended" | "missed" | "declined",
): Promise<void> {
	// Only ringing/active calls can transition to a terminal state.
	if (call.status !== "ringing" && call.status !== "active") return;

	const now = Date.now();
	const duration = call.startedAt ? now - call.startedAt : undefined;

	await ctx.db.patch(call._id, { status, endedAt: now, duration });

	const participants = await getCallParticipants(ctx, call._id);
	for (const p of participants) {
		if (p.status === "joined") {
			await ctx.db.patch(p._id, { status: "left", leftAt: now });
		} else if (p.status === "ringing") {
			await ctx.db.patch(p._id, { status: "missed" });
		}
	}

	// Drop any leftover signaling rows for this call.
	const signals = await ctx.db
		.query("callSignaling")
		.withIndex("by_call_to", (q) => q.eq("callId", call._id))
		.collect();
	for (const s of signals) await ctx.db.delete(s._id);

	// System message in the conversation timeline.
	await ctx.db.insert("messages", {
		conversationId: call.conversationId,
		senderId: call.initiatorId,
		content: "",
		type: "call",
		callData: { callId: call._id, callType: call.type, status, duration },
	});
	await ctx.db.patch(call.conversationId, { lastMessageAt: now });
}

// ---------------------------------------------------------------------------
// Mutations — lifecycle
// ---------------------------------------------------------------------------

export const initiate = mutation({
	args: {
		conversationId: v.id("conversations"),
		type: v.union(v.literal("audio"), v.literal("video")),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) throw new Error("Conversation not found");
		// Scope: 1:1 DM calls only.
		if (conversation.type !== "dm") {
			throw new Error("Calls are only supported in direct messages");
		}

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) throw new Error("Not a member of this conversation");

		const members = await ctx.db
			.query("conversationMembers")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.collect();
		const other = members.find((m) => m.userId !== userId);
		if (!other) throw new Error("No one to call in this conversation");

		// Reject if a call is already live in this conversation.
		const existing = await ctx.db
			.query("calls")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.collect();
		if (existing.some((c) => c.status === "ringing" || c.status === "active")) {
			throw new Error("A call is already in progress");
		}

		const callId = await ctx.db.insert("calls", {
			conversationId: args.conversationId,
			initiatorId: userId,
			type: args.type,
			status: "ringing",
		});

		const now = Date.now();
		const cameraOff = args.type === "audio";
		await ctx.db.insert("callParticipants", {
			callId,
			userId,
			status: "joined",
			joinedAt: now,
			isMuted: false,
			isCameraOff: cameraOff,
			isScreenSharing: false,
		});
		await ctx.db.insert("callParticipants", {
			callId,
			userId: other.userId,
			status: "ringing",
			isMuted: false,
			isCameraOff: cameraOff,
			isScreenSharing: false,
		});

		return callId;
	},
});

export const accept = mutation({
	args: { callId: v.id("calls") },
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		const call = await ctx.db.get(args.callId);
		if (!call) throw new Error("Call not found");

		const participant = await getParticipant(ctx, args.callId, userId);
		if (!participant) throw new Error("Not a participant of this call");
		if (call.status !== "ringing") return; // already resolved

		const now = Date.now();
		await ctx.db.patch(participant._id, { status: "joined", joinedAt: now });
		await ctx.db.patch(args.callId, { status: "active", startedAt: now });
	},
});

export const decline = mutation({
	args: { callId: v.id("calls") },
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		const call = await ctx.db.get(args.callId);
		if (!call) throw new Error("Call not found");

		const participant = await getParticipant(ctx, args.callId, userId);
		if (!participant) throw new Error("Not a participant of this call");

		await ctx.db.patch(participant._id, { status: "declined" });
		await endCall(ctx, call, "declined");
	},
});

export const hangup = mutation({
	args: { callId: v.id("calls") },
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		const call = await ctx.db.get(args.callId);
		if (!call) throw new Error("Call not found");

		const participant = await getParticipant(ctx, args.callId, userId);
		if (!participant) throw new Error("Not a participant of this call");

		// Caller cancelling before the callee answered -> the callee missed the call.
		const isCallerCancelling =
			call.status === "ringing" && call.initiatorId === userId;
		await endCall(ctx, call, isCallerCancelling ? "missed" : "ended");
	},
});

export const timeout = mutation({
	args: { callId: v.id("calls") },
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		const call = await ctx.db.get(args.callId);
		if (!call) throw new Error("Call not found");
		if (call.initiatorId !== userId) {
			throw new Error("Only the caller can time out a call");
		}
		if (call.status !== "ringing") return;

		await endCall(ctx, call, "missed");
	},
});

export const updateParticipantMedia = mutation({
	args: {
		callId: v.id("calls"),
		isMuted: v.optional(v.boolean()),
		isCameraOff: v.optional(v.boolean()),
		isScreenSharing: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		const participant = await getParticipant(ctx, args.callId, userId);
		if (!participant) throw new Error("Not a participant of this call");

		const patch: Partial<Doc<"callParticipants">> = {};
		if (args.isMuted !== undefined) patch.isMuted = args.isMuted;
		if (args.isCameraOff !== undefined) patch.isCameraOff = args.isCameraOff;
		if (args.isScreenSharing !== undefined) {
			patch.isScreenSharing = args.isScreenSharing;
		}
		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(participant._id, patch);
		}
	},
});

// ---------------------------------------------------------------------------
// Mutations — signaling
// ---------------------------------------------------------------------------

export const sendSignal = mutation({
	args: {
		callId: v.id("calls"),
		toUserId: v.id("users"),
		type: v.union(
			v.literal("offer"),
			v.literal("answer"),
			v.literal("ice-candidate"),
		),
		payload: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		if (args.payload.length > MAX_SIGNAL_PAYLOAD) {
			throw new Error("Signal payload too large");
		}

		const call = await ctx.db.get(args.callId);
		if (!call || (call.status !== "ringing" && call.status !== "active")) {
			throw new Error("Call is not active");
		}

		// Sender must be a participant.
		const sender = await getParticipant(ctx, args.callId, userId);
		if (!sender) throw new Error("Not a participant of this call");
		// Recipient must be the *other* participant of this same call.
		const recipient = await getParticipant(ctx, args.callId, args.toUserId);
		if (!recipient || args.toUserId === userId) {
			throw new Error("Invalid signal recipient");
		}

		await ctx.db.insert("callSignaling", {
			callId: args.callId,
			fromUserId: userId,
			toUserId: args.toUserId,
			type: args.type,
			payload: args.payload,
			consumed: false,
		});
	},
});

export const consumeSignals = mutation({
	args: { signalIds: v.array(v.id("callSignaling")) },
	handler: async (ctx, args) => {
		const userId = await requireAuth(ctx);

		for (const signalId of args.signalIds) {
			const signal = await ctx.db.get(signalId);
			// Ownership check: only the addressee may consume, then it's deleted.
			if (signal && signal.toUserId === userId) {
				await ctx.db.delete(signalId);
			}
		}
	},
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const activeCall = query({
	args: { conversationId: v.id("conversations") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const membership = await getMembership(ctx, args.conversationId, userId);
		if (!membership) return null;

		const calls = await ctx.db
			.query("calls")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.collect();

		return (
			calls.find((c) => c.status === "ringing" || c.status === "active") ?? null
		);
	},
});

export const participants = query({
	args: { callId: v.id("calls") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		// Ownership: caller must be a participant of this call.
		const self = await getParticipant(ctx, args.callId, userId);
		if (!self) return [];

		const callParticipants = await getCallParticipants(ctx, args.callId);
		return await Promise.all(
			callParticipants.map(async (p) => {
				const user = await ctx.db.get(p.userId);
				return { ...p, user: user ? toPublicUser(user) : null };
			}),
		);
	},
});

export const pendingSignals = query({
	args: { callId: v.id("calls") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		return await ctx.db
			.query("callSignaling")
			.withIndex("by_call_to", (q) =>
				q
					.eq("callId", args.callId)
					.eq("toUserId", userId)
					.eq("consumed", false),
			)
			.collect();
	},
});

export const incomingCall = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const myParticipations = await ctx.db
			.query("callParticipants")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const ringing = myParticipations.find((p) => p.status === "ringing");
		if (!ringing) return null;

		const call = await ctx.db.get(ringing.callId);
		if (call?.status !== "ringing") return null;

		const conversation = await ctx.db.get(call.conversationId);
		if (!conversation) return null;

		const initiator = await ctx.db.get(call.initiatorId);
		const callerName =
			initiator?.displayName ??
			initiator?.username ??
			initiator?.name ??
			"Inconnu";

		return {
			call,
			conversation: { ...conversation, displayName: callerName },
			initiator: initiator
				? {
						_id: initiator._id,
						username: initiator.username,
						displayName: initiator.displayName,
						image: initiator.image,
					}
				: null,
		};
	},
});
