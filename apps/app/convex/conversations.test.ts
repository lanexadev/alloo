import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	asUser,
	listMessages,
	memberRoles,
	newestMessageTime,
	rawMessages,
	seedDm,
	seedGroup,
	seedUser,
	setReadCursor,
	setupTest,
	systemMessageKinds,
} from "./test.setup";

describe("conversations.createDM", () => {
	it("creates a conversation with both users as members", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");

		const conversationId = await seedDm(t, lucas, camille);

		const members = await memberRoles(t, conversationId);
		expect(members.map((m) => m.userId).sort()).toEqual(
			[lucas, camille].sort(),
		);
	});

	it("returns the existing conversation instead of creating a second one", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");

		const first = await seedDm(t, lucas, camille);
		const second = await seedDm(t, camille, lucas);

		expect(second).toBe(first);
	});

	it("rejects a conversation with a user that no longer exists", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const ghost = await seedUser(t, "ghost");
		await t.run(async (ctx) => ctx.db.delete(ghost));

		await expect(
			asUser(t, lucas).mutation(api.conversations.createDM, { userId: ghost }),
		).rejects.toThrow(/User not found/);
	});

	it("rejects an unauthenticated caller", async () => {
		const t = setupTest();
		const camille = await seedUser(t, "camille");

		await expect(
			t.mutation(api.conversations.createDM, { userId: camille }),
		).rejects.toThrow(/Not authenticated/);
	});
});

describe("conversations.createGroup", () => {
	it("makes the creator an admin and the invitees plain members", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");

		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		expect(await memberRoles(t, conversationId)).toEqual(
			expect.arrayContaining([
				{ userId: lucas, role: "admin" },
				{ userId: camille, role: "member" },
			]),
		);
	});

	it("returns a 128-bit invite code", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		const { inviteCode } = await seedGroup(t, lucas, "Vacances");

		expect(inviteCode).toMatch(/^[0-9a-f]{32}$/);
	});

	it("gives the invite code an expiry date", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		const conversation = await asUser(t, lucas).query(api.conversations.get, {
			conversationId,
		});
		expect(conversation?.inviteCodeExpiresAt).toBeGreaterThan(Date.now());
	});

	it("records the creation as a structured system message", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		expect(await systemMessageKinds(t, conversationId)).toEqual([
			"group_created",
		]);
	});

	it("stores no prose in system messages, so they stay translatable", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		const [message] = await rawMessages(t, conversationId);
		expect(message?.content).toBe("");
		expect(message?.systemData).toMatchObject({
			kind: "group_created",
			actorId: lucas,
			groupName: "Vacances",
		});
	});

	it("ignores the creator when passed in the member list", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		const { conversationId } = await seedGroup(t, lucas, "Vacances", [lucas]);

		expect(await memberRoles(t, conversationId)).toHaveLength(1);
	});

	it("rejects a blank group name", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		await expect(
			asUser(t, lucas).mutation(api.conversations.createGroup, { name: "   " }),
		).rejects.toThrow(/name is required/);
	});

	it("rejects a group name longer than 100 characters", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		await expect(
			asUser(t, lucas).mutation(api.conversations.createGroup, {
				name: "a".repeat(101),
			}),
		).rejects.toThrow(/name too long/);
	});

	it("rejects a group larger than 100 members", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const memberIds: Id<"users">[] = [];
		for (let i = 0; i < 100; i++) {
			memberIds.push(await seedUser(t, `member${i}`));
		}

		await expect(
			asUser(t, lucas).mutation(api.conversations.createGroup, {
				name: "Trop de monde",
				memberIds,
			}),
		).rejects.toThrow(/limited to 100 members/);
	});
});

describe("conversations.addMembers", () => {
	it("adds only the users that are not members yet", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const sofia = await seedUser(t, "sofia");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		const added = await asUser(t, lucas).mutation(
			api.conversations.addMembers,
			{
				conversationId,
				userIds: [camille, sofia, sofia],
			},
		);

		expect(added).toBe(1);
		expect(await memberRoles(t, conversationId)).toHaveLength(3);
	});

	it("refuses a plain member, because adding is as sensitive as removing", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const sofia = await seedUser(t, "sofia");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, camille).mutation(api.conversations.addMembers, {
				conversationId,
				userIds: [sofia],
			}),
		).rejects.toThrow(/Only admins can add members/);
	});

	it("refuses to add members to a direct message", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const sofia = await seedUser(t, "sofia");
		const conversationId = await seedDm(t, lucas, camille);

		await expect(
			asUser(t, lucas).mutation(api.conversations.addMembers, {
				conversationId,
				userIds: [sofia],
			}),
		).rejects.toThrow(/only be added to groups/);
	});

	it("refuses a caller who is not in the group", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const outsider = await seedUser(t, "outsider");
		const sofia = await seedUser(t, "sofia");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await expect(
			asUser(t, outsider).mutation(api.conversations.addMembers, {
				conversationId,
				userIds: [sofia],
			}),
		).rejects.toThrow(/Not a member/);
	});

	it("announces the newcomers in one system message", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await asUser(t, lucas).mutation(api.conversations.addMembers, {
			conversationId,
			userIds: [camille],
		});

		expect(await systemMessageKinds(t, conversationId)).toEqual([
			"group_created",
			"members_added",
		]);
	});
});

describe("conversations.renameGroup", () => {
	it("renames the group and announces it", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await asUser(t, lucas).mutation(api.conversations.renameGroup, {
			conversationId,
			name: "Vacances 2027",
		});

		const conversation = await asUser(t, lucas).query(api.conversations.get, {
			conversationId,
		});
		expect(conversation?.name).toBe("Vacances 2027");
		expect(await systemMessageKinds(t, conversationId)).toContain(
			"group_renamed",
		);
	});

	it("refuses a plain member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, camille).mutation(api.conversations.renameGroup, {
				conversationId,
				name: "Chez moi",
			}),
		).rejects.toThrow(/Only admins/);
	});

	it("stays silent when the name does not actually change", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await asUser(t, lucas).mutation(api.conversations.renameGroup, {
			conversationId,
			name: "Vacances",
		});

		expect(await systemMessageKinds(t, conversationId)).toEqual([
			"group_created",
		]);
	});
});

describe("conversations.setMemberRole", () => {
	it("promotes a member to admin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await asUser(t, lucas).mutation(api.conversations.setMemberRole, {
			conversationId,
			userId: camille,
			role: "admin",
		});

		expect(await memberRoles(t, conversationId)).toContainEqual({
			userId: camille,
			role: "admin",
		});
	});

	it("refuses to demote the last remaining admin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, lucas).mutation(api.conversations.setMemberRole, {
				conversationId,
				userId: lucas,
				role: "member",
			}),
		).rejects.toThrow(/at least one admin/);
	});

	it("allows a demotion once a second admin exists", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);
		await asUser(t, lucas).mutation(api.conversations.setMemberRole, {
			conversationId,
			userId: camille,
			role: "admin",
		});

		await asUser(t, lucas).mutation(api.conversations.setMemberRole, {
			conversationId,
			userId: lucas,
			role: "member",
		});

		expect(await memberRoles(t, conversationId)).toContainEqual({
			userId: lucas,
			role: "member",
		});
	});

	it("refuses a caller who is not an admin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, camille).mutation(api.conversations.setMemberRole, {
				conversationId,
				userId: camille,
				role: "admin",
			}),
		).rejects.toThrow(/Only admins/);
	});

	it("refuses a target who is not in the group", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const outsider = await seedUser(t, "outsider");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await expect(
			asUser(t, lucas).mutation(api.conversations.setMemberRole, {
				conversationId,
				userId: outsider,
				role: "admin",
			}),
		).rejects.toThrow(/not a member/);
	});
});

describe("conversations.regenerateInviteCode", () => {
	it("invalidates the previous link", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId, inviteCode } = await seedGroup(
			t,
			lucas,
			"Vacances",
		);

		await asUser(t, lucas).mutation(api.conversations.regenerateInviteCode, {
			conversationId,
		});

		await expect(
			asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
				inviteCode,
			}),
		).rejects.toThrow(/Invalid invite code/);
	});

	it("hands out a working replacement code", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		const { inviteCode } = await asUser(t, lucas).mutation(
			api.conversations.regenerateInviteCode,
			{ conversationId },
		);

		await expect(
			asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
				inviteCode,
			}),
		).resolves.toBe(conversationId);
	});

	it("refuses a plain member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, camille).mutation(api.conversations.regenerateInviteCode, {
				conversationId,
			}),
		).rejects.toThrow(/Only admins/);
	});

	it("rejects a lifetime beyond a year", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await expect(
			asUser(t, lucas).mutation(api.conversations.regenerateInviteCode, {
				conversationId,
				expiresInDays: 400,
			}),
		).rejects.toThrow(/between 1 and 365 days/);
	});
});

describe("conversations.joinByInviteCode", () => {
	it("adds the caller to the group", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId, inviteCode } = await seedGroup(
			t,
			lucas,
			"Vacances",
		);

		const joined = await asUser(t, camille).mutation(
			api.conversations.joinByInviteCode,
			{ inviteCode },
		);

		expect(joined).toBe(conversationId);
		expect(await memberRoles(t, conversationId)).toContainEqual({
			userId: camille,
			role: "member",
		});
	});

	it("is a no-op for someone who already joined", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId, inviteCode } = await seedGroup(
			t,
			lucas,
			"Vacances",
		);

		await asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
			inviteCode,
		});
		await asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
			inviteCode,
		});

		expect(await memberRoles(t, conversationId)).toHaveLength(2);
	});

	it("rejects an expired invite link", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId, inviteCode } = await seedGroup(
			t,
			lucas,
			"Vacances",
		);
		await t.run(async (ctx) =>
			ctx.db.patch(conversationId, {
				inviteCodeExpiresAt: Date.now() - 1000,
			}),
		);

		await expect(
			asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
				inviteCode,
			}),
		).rejects.toThrow(/expired/);
	});

	it("still honours legacy codes that carry no expiry", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId, inviteCode } = await seedGroup(
			t,
			lucas,
			"Vacances",
		);
		await t.run(async (ctx) =>
			ctx.db.patch(conversationId, { inviteCodeExpiresAt: undefined }),
		);

		await expect(
			asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
				inviteCode,
			}),
		).resolves.toBe(conversationId);
	});

	it("rejects an unknown invite code", async () => {
		const t = setupTest();
		const camille = await seedUser(t, "camille");

		await expect(
			asUser(t, camille).mutation(api.conversations.joinByInviteCode, {
				inviteCode: "deadbeef",
			}),
		).rejects.toThrow(/Invalid invite code/);
	});
});

describe("conversations.removeMember", () => {
	it("removes the member and announces it", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await asUser(t, lucas).mutation(api.conversations.removeMember, {
			conversationId,
			userId: camille,
		});

		expect(await memberRoles(t, conversationId)).toHaveLength(1);
		expect(await systemMessageKinds(t, conversationId)).toContain(
			"member_removed",
		);
	});

	it("refuses a caller who is not an admin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, camille).mutation(api.conversations.removeMember, {
				conversationId,
				userId: lucas,
			}),
		).rejects.toThrow(/Only admins/);
	});

	it("redirects self-removal to leaveGroup", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, lucas).mutation(api.conversations.removeMember, {
				conversationId,
				userId: lucas,
			}),
		).rejects.toThrow(/Use leaveGroup/);
	});

	it("never leaves the group without an admin", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);
		await asUser(t, lucas).mutation(api.conversations.setMemberRole, {
			conversationId,
			userId: camille,
			role: "admin",
		});
		await asUser(t, lucas).mutation(api.conversations.setMemberRole, {
			conversationId,
			userId: lucas,
			role: "member",
		});

		await expect(
			asUser(t, camille).mutation(api.conversations.removeMember, {
				conversationId,
				userId: camille,
			}),
		).rejects.toThrow(/Use leaveGroup/);
	});

	it("silently ignores a user who is not a member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const outsider = await seedUser(t, "outsider");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await expect(
			asUser(t, lucas).mutation(api.conversations.removeMember, {
				conversationId,
				userId: outsider,
			}),
		).resolves.toBeNull();
	});
});

describe("conversations.leaveGroup", () => {
	it("promotes the longest-standing member when the last admin leaves", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await asUser(t, lucas).mutation(api.conversations.leaveGroup, {
			conversationId,
		});

		expect(await memberRoles(t, conversationId)).toEqual([
			{ userId: camille, role: "admin" },
		]);
	});

	it("keeps the existing admin instead of promoting anyone", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await asUser(t, camille).mutation(api.conversations.leaveGroup, {
			conversationId,
		});

		expect(await systemMessageKinds(t, conversationId)).not.toContain(
			"admin_promoted",
		);
	});

	it("deletes the conversation once everybody left", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await asUser(t, lucas).mutation(api.conversations.leaveGroup, {
			conversationId,
		});

		expect(await t.run(async (ctx) => ctx.db.get(conversationId))).toBeNull();
	});

	it("purges the orphaned messages in the background", async () => {
		vi.useFakeTimers();
		try {
			const t = setupTest();
			const lucas = await seedUser(t, "lucas");
			const { conversationId } = await seedGroup(t, lucas, "Vacances");

			await asUser(t, lucas).mutation(api.conversations.leaveGroup, {
				conversationId,
			});
			await t.finishAllScheduledFunctions(vi.runAllTimers);

			expect(await rawMessages(t, conversationId)).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("does nothing for someone who is not a member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const outsider = await seedUser(t, "outsider");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		await asUser(t, outsider).mutation(api.conversations.leaveGroup, {
			conversationId,
		});

		expect(await memberRoles(t, conversationId)).toHaveLength(1);
	});
});

describe("conversations.get", () => {
	it("shows the other participant as the DM title", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);

		const conversation = await asUser(t, lucas).query(api.conversations.get, {
			conversationId,
		});

		expect(conversation?.displayName).toBe("camille");
	});

	it("reports the caller's own role", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		const conversation = await asUser(t, camille).query(api.conversations.get, {
			conversationId,
		});

		expect(conversation?.currentUserRole).toBe("member");
	});

	it("returns null to somebody who is not a member", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const outsider = await seedUser(t, "outsider");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");

		expect(
			await asUser(t, outsider).query(api.conversations.get, {
				conversationId,
			}),
		).toBeNull();
	});

	it("returns null for an id that is not a conversation, rather than throwing", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		expect(
			await asUser(t, lucas).query(api.conversations.get, {
				conversationId: "not-a-real-id",
			}),
		).toBeNull();
	});
});

describe("conversations.list", () => {
	it("counts messages received since the member last read the conversation", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		// Backdate the membership so the new message is unambiguously newer.
		await t.run(async (ctx) => {
			const membership = await ctx.db
				.query("conversationMembers")
				.withIndex("by_conversation_user", (q) =>
					q.eq("conversationId", conversationId).eq("userId", camille),
				)
				.unique();
			if (membership) {
				await ctx.db.patch(membership._id, { joinedAt: Date.now() - 10_000 });
			}
		});

		await asUser(t, lucas).mutation(api.messages.send, {
			conversationId,
			content: "Salut",
		});

		const [conversation] = await asUser(t, camille).query(
			api.conversations.list,
			{},
		);
		expect(conversation?.unreadCount).toBe(1);
	});

	it("counts nothing as unread once the read cursor reaches the newest message", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await asUser(t, lucas).mutation(api.messages.send, {
			conversationId,
			content: "Salut",
		});

		await setReadCursor(
			t,
			conversationId,
			camille,
			await newestMessageTime(t, conversationId),
		);

		const [conversation] = await asUser(t, camille).query(
			api.conversations.list,
			{},
		);
		expect(conversation?.unreadCount).toBe(0);
	});

	it("markAsRead moves the member's read cursor forward", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		await setReadCursor(t, conversationId, camille, 0);

		await asUser(t, camille).mutation(api.conversations.markAsRead, {
			conversationId,
		});

		const membership = await t.run(async (ctx) =>
			ctx.db
				.query("conversationMembers")
				.withIndex("by_conversation_user", (q) =>
					q.eq("conversationId", conversationId).eq("userId", camille),
				)
				.unique(),
		);
		expect(membership?.lastReadAt).toBeGreaterThan(0);
	});

	it("caps the unread badge at 99 and flags the overflow", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const conversationId = await seedDm(t, lucas, camille);
		// Written straight to the table: `send` is rate limited to bursts of 20.
		await t.run(async (ctx) => {
			for (let i = 0; i < 101; i++) {
				await ctx.db.insert("messages", {
					conversationId,
					senderId: lucas,
					content: `message ${i}`,
				});
			}
		});

		const [conversation] = await asUser(t, camille).query(
			api.conversations.list,
			{},
		);
		expect(conversation?.unreadCount).toBe(99);
		expect(conversation?.hasMoreUnread).toBe(true);
	});

	it("never exposes the invite code in the sidebar payload", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		await seedGroup(t, lucas, "Vacances");

		const [conversation] = await asUser(t, lucas).query(
			api.conversations.list,
			{},
		);
		expect(conversation).not.toHaveProperty("inviteCode");
	});

	it("puts the most recently active conversation first", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const older = await seedDm(t, lucas, camille);
		const { conversationId: newer } = await seedGroup(t, lucas, "Vacances");
		await asUser(t, lucas).mutation(api.messages.send, {
			conversationId: older,
			content: "Salut",
		});

		const conversations = await asUser(t, lucas).query(
			api.conversations.list,
			{},
		);

		expect(conversations.map((c) => c._id)).toEqual([older, newer]);
	});

	it("returns nothing to a user with no conversations", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");

		expect(await asUser(t, lucas).query(api.conversations.list, {})).toEqual(
			[],
		);
	});
});

describe("system message rendering data", () => {
	it("resolves the actor and targets to display names", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances");
		await asUser(t, lucas).mutation(api.conversations.addMembers, {
			conversationId,
			userIds: [camille],
		});

		const [newest] = await listMessages(t, lucas, conversationId);

		expect(newest?.system).toMatchObject({
			kind: "members_added",
			actorName: "lucas",
			targetNames: ["camille"],
		});
	});
});
