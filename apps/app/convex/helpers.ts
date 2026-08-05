import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Online if the heartbeat (30s) was seen recently. */
const ONLINE_WINDOW_MS = 60_000;

/**
 * Membership lookup through the `by_conversation_user` index.
 *
 * Reads exactly one document instead of every member of the conversation, which
 * matters because every query and mutation in the app starts with this check.
 */
export async function getMembership(
	ctx: QueryCtx | MutationCtx,
	conversationId: Id<"conversations">,
	userId: Id<"users">,
): Promise<Doc<"conversationMembers"> | null> {
	return await ctx.db
		.query("conversationMembers")
		.withIndex("by_conversation_user", (q) =>
			q.eq("conversationId", conversationId).eq("userId", userId),
		)
		.unique();
}

/** Membership or a thrown error — the guard most mutations want. */
export async function requireMembership(
	ctx: QueryCtx | MutationCtx,
	conversationId: Id<"conversations">,
	userId: Id<"users">,
): Promise<Doc<"conversationMembers">> {
	const membership = await getMembership(ctx, conversationId, userId);
	if (!membership) throw new Error("Not a member of this conversation");
	return membership;
}

export interface PublicUser {
	_id: Id<"users">;
	username?: string;
	displayName?: string;
	name?: string;
	bio?: string;
	image?: string;
	isOnline: boolean;
	lastSeenAt?: number;
}

export function toPublicUser(user: Doc<"users">): PublicUser {
	return {
		_id: user._id,
		username: user.username,
		displayName: user.displayName,
		name: user.name,
		bio: user.bio,
		image: user.image,
		isOnline:
			user.isOnline === true &&
			user.lastSeenAt != null &&
			Date.now() - user.lastSeenAt < ONLINE_WINDOW_MS,
		lastSeenAt: user.lastSeenAt,
	};
}

export async function getUserInfo(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
): Promise<PublicUser | null> {
	const user = await ctx.db.get(userId);
	return user ? toPublicUser(user) : null;
}

/**
 * Reads each user at most once per request.
 *
 * Message lists resolve the same handful of senders over and over; without a
 * cache a 50-message page costs 50 document reads for 3 distinct people.
 */
export class UserCache {
	private readonly cache = new Map<string, PublicUser | null>();

	constructor(private readonly ctx: QueryCtx | MutationCtx) {}

	async get(userId: Id<"users">): Promise<PublicUser | null> {
		const cached = this.cache.get(userId);
		if (cached !== undefined) return cached;
		const user = await getUserInfo(this.ctx, userId);
		this.cache.set(userId, user);
		return user;
	}

	/** Best display name, or `null` when the user is gone. The client picks the fallback wording. */
	async displayName(userId: Id<"users">): Promise<string | null> {
		const user = await this.get(userId);
		if (!user) return null;
		return user.displayName ?? user.name ?? user.username ?? null;
	}
}

export type SystemMessageData = NonNullable<Doc<"messages">["systemData"]>;
export type SystemMessageKind = SystemMessageData["kind"];

/**
 * System messages are stored structurally (`{ kind, actorId, … }`) and rendered
 * client-side, so the wording stays translatable after the fact. This resolves
 * the ids to names; the phrasing lives in src/lib/system-message.ts.
 */
export interface ResolvedSystemMessage {
	kind: SystemMessageKind;
	actorName: string | null;
	targetNames: string[];
	groupName?: string;
}

export async function resolveSystemMessage(
	cache: UserCache,
	data: SystemMessageData,
): Promise<ResolvedSystemMessage> {
	const targetNames = await Promise.all(
		(data.targetIds ?? []).map((id) => cache.displayName(id)),
	);
	return {
		kind: data.kind,
		actorName: await cache.displayName(data.actorId),
		targetNames: targetNames.filter((name): name is string => name !== null),
		groupName: data.groupName,
	};
}
