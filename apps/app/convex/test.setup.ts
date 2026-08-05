/**
 * Shared helpers for the Convex function tests.
 *
 * The filename has two dots on purpose: the Convex bundler skips any file in
 * `convex/` whose basename contains more than one dot, so this module (and the
 * `*.test.ts` files) never ship to a deployment.
 */
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { SystemMessageKind } from "./helpers";
import schema from "./schema";

// `vite/client` is not installed (vitest vendors Vite), so the one API we borrow
// from it is declared here.
declare global {
	interface ImportMeta {
		glob(patterns: string[]): Record<string, () => Promise<unknown>>;
	}
}

// Convex functions are loaded lazily by convex-test; test files are excluded so
// they are never mistaken for function modules.
const modules = import.meta.glob([
	"./**/*.*s",
	"!./**/*.test.*",
	"!./test.setup.*",
]);

export function setupTest() {
	return convexTest(schema, modules);
}

// Inferred from the call so `t.run(ctx => …)` keeps the schema's tables and indexes.
export type TestConvex = ReturnType<typeof setupTest>;

/**
 * `getAuthUserId` reads the identity subject as `<userId>|<sessionId>`, which is
 * what Convex Auth puts there in production.
 */
export function asUser(t: TestConvex, userId: Id<"users">) {
	return t.withIdentity({ subject: `${userId}|test-session` });
}

export async function seedUser(
	t: TestConvex,
	username: string,
): Promise<Id<"users">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("users", {
			username,
			displayName: username,
			onboardingCompleted: true,
		}),
	);
}

/** Creates a group owned by `ownerId`, returning its id and invite code. */
export async function seedGroup(
	t: TestConvex,
	ownerId: Id<"users">,
	name: string,
	memberIds: Id<"users">[] = [],
) {
	return await asUser(t, ownerId).mutation(api.conversations.createGroup, {
		name,
		memberIds,
	});
}

/** Creates a DM between two users and returns the conversation id. */
export async function seedDm(
	t: TestConvex,
	a: Id<"users">,
	b: Id<"users">,
): Promise<Id<"conversations">> {
	return await asUser(t, a).mutation(api.conversations.createDM, { userId: b });
}

/** Roles of every member of a conversation, read straight from the table. */
export async function memberRoles(
	t: TestConvex,
	conversationId: Id<"conversations">,
) {
	return await t.run(async (ctx) => {
		const members = await ctx.db
			.query("conversationMembers")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", conversationId),
			)
			.collect();
		return members.map((m) => ({ userId: m.userId, role: m.role }));
	});
}

/**
 * Kinds of the system messages of a conversation, oldest first.
 *
 * System messages carry no prose — only `{ kind, actorId, … }` — so the tests
 * assert on the structured payload rather than on a rendered sentence.
 */
export async function systemMessageKinds(
	t: TestConvex,
	conversationId: Id<"conversations">,
): Promise<SystemMessageKind[]> {
	return await t.run(async (ctx) => {
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", conversationId),
			)
			.collect();
		return messages
			.map((m) => m.systemData?.kind)
			.filter((kind): kind is SystemMessageKind => kind !== undefined);
	});
}

/** Every message document of a conversation, oldest first. */
export async function rawMessages(
	t: TestConvex,
	conversationId: Id<"conversations">,
) {
	return await t.run(async (ctx) =>
		ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", conversationId),
			)
			.collect(),
	);
}

/**
 * Set a member's read cursor to an exact timestamp.
 *
 * `markAsRead` stamps `Date.now()`, but convex-test hands out `_creationTime`
 * values that can sit a millisecond or two ahead of the wall clock, which makes
 * "read the whole conversation" flaky. Read-cursor behaviour is therefore driven
 * from an explicit timestamp; `markAsRead` itself is covered separately.
 */
export async function setReadCursor(
	t: TestConvex,
	conversationId: Id<"conversations">,
	userId: Id<"users">,
	lastReadAt: number,
): Promise<void> {
	await t.run(async (ctx) => {
		const membership = await ctx.db
			.query("conversationMembers")
			.withIndex("by_conversation_user", (q) =>
				q.eq("conversationId", conversationId).eq("userId", userId),
			)
			.unique();
		if (!membership) throw new Error("membership not found");
		await ctx.db.patch(membership._id, { lastReadAt });
	});
}

/** `_creationTime` of the most recent message of a conversation. */
export async function newestMessageTime(
	t: TestConvex,
	conversationId: Id<"conversations">,
): Promise<number> {
	const messages = await rawMessages(t, conversationId);
	const newest = messages[messages.length - 1];
	if (!newest) throw new Error("conversation has no messages");
	return newest._creationTime;
}

/** First page of `messages.list` as the given user — newest message first. */
export async function listMessages(
	t: TestConvex,
	userId: Id<"users">,
	conversationId: Id<"conversations">,
	numItems = 50,
) {
	const result = await asUser(t, userId).query(api.messages.list, {
		conversationId,
		paginationOpts: { numItems, cursor: null },
	});
	return result.page;
}
