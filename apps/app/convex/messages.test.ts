import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	asUser,
	listMessages,
	newestMessageTime,
	rawMessages,
	seedDm,
	seedGroup,
	seedUser,
	setReadCursor,
	setupTest,
	type TestConvex,
} from "./test.setup";

/** Sends a message and returns its id. */
async function send(
	t: TestConvex,
	userId: Id<"users">,
	conversationId: Id<"conversations">,
	content: string,
	replyToId?: Id<"messages">,
): Promise<Id<"messages">> {
	await asUser(t, userId).mutation(api.messages.send, {
		conversationId,
		content,
		replyToId,
	});
	const messages = await rawMessages(t, conversationId);
	const last = messages[messages.length - 1];
	if (!last) throw new Error("message was not stored");
	return last._id;
}

describe("messages.send", () => {
	it("stores the message in the conversation", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await send(t, lucas, conversationId, "Salut");

		const page = await listMessages(t, camille, conversationId);
		expect(page.map((m) => m.content)).toEqual(["Salut"]);
	});

	it("trims surrounding whitespace", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await send(t, lucas, conversationId, "   Salut   ");

		const [message] = await listMessages(t, lucas, conversationId);
		expect(message?.content).toBe("Salut");
	});

	it("rejects a message that is only whitespace", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await expect(
			asUser(t, lucas).mutation(api.messages.send, {
				conversationId,
				content: "   ",
			}),
		).rejects.toThrow(/cannot be empty/);
	});

	it("rejects a message longer than 4000 characters", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await expect(
			asUser(t, lucas).mutation(api.messages.send, {
				conversationId,
				content: "a".repeat(4001),
			}),
		).rejects.toThrow(/too long/);
	});

	it("rejects a sender who is not a member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const outsider = await seedUser(t, "outsider");
		const conversationId = await seedDm(t, lucas, camille);

		await expect(
			asUser(t, outsider).mutation(api.messages.send, {
				conversationId,
				content: "Coucou",
			}),
		).rejects.toThrow(/Not a member/);
	});

	it("rejects a reply to a message from another conversation", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const dm = await seedDm(t, lucas, camille);
		const { conversationId: group } = await seedGroup(t, lucas, "Vacances");
		const elsewhere = await send(t, lucas, group, "Ailleurs");

		await expect(
			asUser(t, lucas).mutation(api.messages.send, {
				conversationId: dm,
				content: "Réponse",
				replyToId: elsewhere,
			}),
		).rejects.toThrow(/not found in this conversation/);
	});

	it("bumps the conversation's last activity", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await send(t, lucas, conversationId, "Salut");

		const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
		expect(conversation?.lastMessageAt).toBeTypeOf("number");
	});

	it("clears the sender's typing indicator", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await asUser(t, lucas).mutation(api.messages.setTyping, { conversationId });

		await send(t, lucas, conversationId, "Salut");

		expect(
			await asUser(t, camille).query(api.messages.getTypingUsers, {
				conversationId,
			}),
		).toEqual([]);
	});

	it("rate limits a burst beyond 20 messages", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		for (let i = 0; i < 20; i++) {
			await send(t, lucas, conversationId, `message ${i}`);
		}

		await expect(
			asUser(t, lucas).mutation(api.messages.send, {
				conversationId,
				content: "un de trop",
			}),
		).rejects.toThrow(/Rate limit exceeded/);
	});

	it("rate limits each user separately", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		for (let i = 0; i < 20; i++) {
			await send(t, lucas, conversationId, `message ${i}`);
		}

		await expect(
			asUser(t, camille).mutation(api.messages.send, {
				conversationId,
				content: "moi je passe",
			}),
		).resolves.toBeNull();
	});
});

describe("messages.list", () => {
	it("returns the newest messages first", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await send(t, lucas, conversationId, "un");
		await send(t, lucas, conversationId, "deux");

		const page = await listMessages(t, lucas, conversationId);

		expect(page.map((m) => m.content)).toEqual(["deux", "un"]);
	});

	it("paginates instead of returning the whole history", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		for (let i = 0; i < 5; i++) {
			await send(t, lucas, conversationId, `message ${i}`);
		}

		const result = await asUser(t, lucas).query(api.messages.list, {
			conversationId,
			paginationOpts: { numItems: 2, cursor: null },
		});

		expect(result.page).toHaveLength(2);
		expect(result.isDone).toBe(false);
	});

	it("marks the caller's own messages", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await send(t, lucas, conversationId, "Salut");

		const [asSender] = await listMessages(t, lucas, conversationId);
		const [asRecipient] = await listMessages(t, camille, conversationId);

		expect(asSender?.isOwn).toBe(true);
		expect(asRecipient?.isOwn).toBe(false);
	});

	it("flags a message as read once the other member caught up", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await send(t, lucas, conversationId, "Salut");

		await setReadCursor(
			t,
			conversationId,
			camille,
			await newestMessageTime(t, conversationId),
		);

		const [message] = await listMessages(t, lucas, conversationId);
		expect(message?.isRead).toBe(true);
	});

	it("does not flag a message as read before the other member opened it", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await send(t, lucas, conversationId, "Salut");

		const [message] = await listMessages(t, lucas, conversationId);
		expect(message?.isRead).toBe(false);
	});

	it("includes a preview of the quoted message", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const original = await send(t, lucas, conversationId, "Question ?");
		await send(t, camille, conversationId, "Réponse", original);

		const [reply] = await listMessages(t, camille, conversationId);

		expect(reply?.replyTo).toMatchObject({
			content: "Question ?",
			senderName: "lucas",
			isOwn: false,
		});
	});

	it("groups reactions by emoji and marks the caller's own", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");
		await asUser(t, lucas).mutation(api.messages.toggleReaction, {
			messageId,
			emoji: "👍",
		});
		await asUser(t, camille).mutation(api.messages.toggleReaction, {
			messageId,
			emoji: "👍",
		});

		const [message] = await listMessages(t, lucas, conversationId);

		expect(message?.reactions).toEqual([
			{ emoji: "👍", count: 2, reactedByMe: true },
		]);
	});

	it("returns nothing to a user who is not a member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const outsider = await seedUser(t, "outsider");
		const conversationId = await seedDm(t, lucas, camille);
		await send(t, lucas, conversationId, "Salut");

		expect(await listMessages(t, outsider, conversationId)).toEqual([]);
	});

	it("returns nothing when nobody is signed in", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await send(t, lucas, conversationId, "Salut");

		const result = await t.query(api.messages.list, {
			conversationId,
			paginationOpts: { numItems: 10, cursor: null },
		});
		expect(result.page).toEqual([]);
	});
});

describe("messages.toggleReaction", () => {
	it("lets one user hold several different reactions on a message", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await asUser(t, lucas).mutation(api.messages.toggleReaction, {
			messageId,
			emoji: "👍",
		});
		await asUser(t, lucas).mutation(api.messages.toggleReaction, {
			messageId,
			emoji: "🎉",
		});

		const [message] = await listMessages(t, lucas, conversationId);
		expect(message?.reactions.map((r) => r.emoji).sort()).toEqual(
			["🎉", "👍"].sort(),
		);
	});

	it("removes the reaction when the same emoji is picked twice", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await asUser(t, lucas).mutation(api.messages.toggleReaction, {
			messageId,
			emoji: "👍",
		});
		await asUser(t, lucas).mutation(api.messages.toggleReaction, {
			messageId,
			emoji: "👍",
		});

		const [message] = await listMessages(t, lucas, conversationId);
		expect(message?.reactions).toEqual([]);
	});

	it("rejects an empty emoji", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await expect(
			asUser(t, lucas).mutation(api.messages.toggleReaction, {
				messageId,
				emoji: "  ",
			}),
		).rejects.toThrow(/Invalid emoji/);
	});

	it("rejects an oversized emoji payload", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await expect(
			asUser(t, lucas).mutation(api.messages.toggleReaction, {
				messageId,
				emoji: "a".repeat(17),
			}),
		).rejects.toThrow(/Invalid emoji/);
	});

	it("rejects a user who is not in the conversation", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const outsider = await seedUser(t, "outsider");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await expect(
			asUser(t, outsider).mutation(api.messages.toggleReaction, {
				messageId,
				emoji: "👍",
			}),
		).rejects.toThrow(/Not a member/);
	});
});

describe("messages.deleteForMe", () => {
	it("hides the message from the caller only", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await asUser(t, lucas).mutation(api.messages.deleteForMe, { messageId });

		expect(await listMessages(t, lucas, conversationId)).toEqual([]);
		expect(await listMessages(t, camille, conversationId)).toHaveLength(1);
	});

	it("is idempotent", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await asUser(t, lucas).mutation(api.messages.deleteForMe, { messageId });
		await asUser(t, lucas).mutation(api.messages.deleteForMe, { messageId });

		const deletions = await t.run(async (ctx) =>
			ctx.db.query("messageDeletions").collect(),
		);
		expect(deletions).toHaveLength(1);
	});

	it("keeps the message itself intact for everyone else", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "Salut");

		await asUser(t, lucas).mutation(api.messages.deleteForMe, { messageId });

		expect(await rawMessages(t, conversationId)).toHaveLength(1);
	});
});

describe("messages.togglePin", () => {
	it("pins a message and lists it", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "À retenir");

		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		const pinned = await asUser(t, lucas).query(api.messages.listPinned, {
			conversationId,
		});
		expect(pinned.map((m) => m.content)).toEqual(["À retenir"]);
	});

	it("lets the member who pinned it unpin it", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);
		const messageId = await send(t, camille, conversationId, "À retenir");
		await asUser(t, camille).mutation(api.messages.togglePin, { messageId });

		await asUser(t, camille).mutation(api.messages.togglePin, { messageId });

		expect(
			await asUser(t, camille).query(api.messages.listPinned, {
				conversationId,
			}),
		).toEqual([]);
	});

	it("refuses to let a plain member unpin somebody else's pin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);
		const messageId = await send(t, lucas, conversationId, "À retenir");
		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		await expect(
			asUser(t, camille).mutation(api.messages.togglePin, { messageId }),
		).rejects.toThrow(/Only an admin or the member who pinned it/);
	});

	it("lets an admin unpin anybody's pin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);
		const messageId = await send(t, camille, conversationId, "À retenir");
		await asUser(t, camille).mutation(api.messages.togglePin, { messageId });

		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		expect(
			await asUser(t, lucas).query(api.messages.listPinned, { conversationId }),
		).toEqual([]);
	});

	it("lets either participant unpin in a direct message, which has no admin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "À retenir");
		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		await asUser(t, camille).mutation(api.messages.togglePin, { messageId });

		expect(
			await asUser(t, camille).query(api.messages.listPinned, {
				conversationId,
			}),
		).toEqual([]);
	});

	it("hides a pinned message the caller deleted for themselves", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "À retenir");
		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		await asUser(t, lucas).mutation(api.messages.deleteForMe, { messageId });

		expect(
			await asUser(t, lucas).query(api.messages.listPinned, { conversationId }),
		).toEqual([]);
	});
});

describe("messages.listPinned", () => {
	it("returns nothing to a user who is not a member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const outsider = await seedUser(t, "outsider");
		const conversationId = await seedDm(t, lucas, camille);
		const messageId = await send(t, lucas, conversationId, "À retenir");
		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		expect(
			await asUser(t, outsider).query(api.messages.listPinned, {
				conversationId,
			}),
		).toEqual([]);
	});

	it("tells each member whether they may unpin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);
		const messageId = await send(t, lucas, conversationId, "À retenir");
		await asUser(t, lucas).mutation(api.messages.togglePin, { messageId });

		const [forAdmin] = await asUser(t, lucas).query(api.messages.listPinned, {
			conversationId,
		});
		const [forMember] = await asUser(t, camille).query(
			api.messages.listPinned,
			{ conversationId },
		);

		expect(forAdmin?.canUnpin).toBe(true);
		expect(forMember?.canUnpin).toBe(false);
	});
});

describe("messages typing indicators", () => {
	it("shows the other participant as typing", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await asUser(t, lucas).mutation(api.messages.setTyping, { conversationId });

		expect(
			await asUser(t, camille).query(api.messages.getTypingUsers, {
				conversationId,
			}),
		).toEqual(["lucas"]);
	});

	it("never reports the caller back to themselves", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		await asUser(t, lucas).mutation(api.messages.setTyping, { conversationId });

		expect(
			await asUser(t, lucas).query(api.messages.getTypingUsers, {
				conversationId,
			}),
		).toEqual([]);
	});

	it("drops indicators that have expired", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await asUser(t, lucas).mutation(api.messages.setTyping, { conversationId });
		await t.run(async (ctx) => {
			const entry = await ctx.db
				.query("typingIndicators")
				.withIndex("by_conversation_user", (q) =>
					q.eq("conversationId", conversationId).eq("userId", lucas),
				)
				.unique();
			if (entry) await ctx.db.patch(entry._id, { expiresAt: Date.now() - 1 });
		});

		expect(
			await asUser(t, camille).query(api.messages.getTypingUsers, {
				conversationId,
			}),
		).toEqual([]);
	});

	it("ignores a typing ping from a non-member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const outsider = await seedUser(t, "outsider");
		const conversationId = await seedDm(t, lucas, camille);

		await asUser(t, outsider).mutation(api.messages.setTyping, {
			conversationId,
		});

		expect(
			await t.run(async (ctx) => ctx.db.query("typingIndicators").collect()),
		).toEqual([]);
	});
});
