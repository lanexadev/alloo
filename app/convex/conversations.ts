import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

async function getMembership(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  return members.find((m) => m.userId === userId) ?? null;
}

async function getUserInfo(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    name: user.name,
    bio: user.bio,
    image: user.image,
    // Consider online if lastSeenAt is within 60s (heartbeat is 30s)
    isOnline:
      user.isOnline === true &&
      user.lastSeenAt != null &&
      Date.now() - user.lastSeenAt < 60_000,
    lastSeenAt: user.lastSeenAt,
  };
}

async function displayNameOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  const user = await ctx.db.get(userId);
  return user?.displayName ?? user?.name ?? user?.username ?? "Quelqu'un";
}

// System messages are stored as pre-rendered French text (app UI is French)
async function insertSystemMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  actorId: Id<"users">,
  content: string
) {
  await ctx.db.insert("messages", {
    conversationId,
    senderId: actorId,
    content,
    type: "system",
  });
  await ctx.db.patch(conversationId, { lastMessageAt: Date.now() });
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

    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const conversation = await ctx.db.get(m.conversationId);
        if (!conversation) return null;

        const members = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        const memberUsers = await Promise.all(
          members.map((mem) => getUserInfo(ctx, mem.userId))
        );

        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .first();

        const readSince = m.lastReadAt ?? m.joinedAt;
        const allMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();
        const unreadCount = allMessages.filter(
          (msg) => msg._creationTime > readSince
        ).length;

        let displayName = conversation.name;
        if (conversation.type === "dm") {
          const otherUser = memberUsers.find(
            (u) => u && u._id !== userId
          );
          displayName = otherUser?.username ?? otherUser?.name ?? "Unknown";
        }

        return {
          ...conversation,
          displayName,
          members: memberUsers.filter(Boolean),
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                createdAt: lastMessage._creationTime,
              }
            : null,
          unreadCount,
          membership: m,
        };
      })
    );

    return conversations
      .filter(Boolean)
      .sort(
        (a, b) =>
          (b!.lastMessageAt ?? b!._creationTime) -
          (a!.lastMessageAt ?? a!._creationTime)
      );
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return null;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const memberUsers = await Promise.all(
      members.map(async (m) => {
        const info = await getUserInfo(ctx, m.userId);
        return info ? { ...info, role: m.role } : null;
      })
    );

    let displayName = conversation.name;
    if (conversation.type === "dm") {
      const otherUser = memberUsers.find(
        (u) => u && u._id !== userId
      );
      displayName = otherUser?.username ?? otherUser?.name ?? "Unknown";
    }

    return {
      ...conversation,
      displayName,
      members: memberUsers.filter(Boolean),
      currentUserRole: membership.role,
    };
  },
});

export const createDM = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    // Verify target user exists
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
        args.userId
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

const MAX_GROUP_MEMBERS = 100;

export const createGroup = mutation({
  args: {
    name: v.string(),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (!args.name.trim()) throw new Error("Group name is required");
    if (args.name.length > 100) throw new Error("Group name too long");

    const initialMemberIds = [...new Set(args.memberIds ?? [])].filter(
      (id) => id !== userId
    );
    if (initialMemberIds.length + 1 > MAX_GROUP_MEMBERS) {
      throw new Error("Group is limited to 100 members");
    }
    for (const memberId of initialMemberIds) {
      const user = await ctx.db.get(memberId);
      if (!user) throw new Error("User not found");
    }

    // Cryptographically secure invite code (128 bits)
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const inviteCode = Array.from(array, (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

    const conversationId = await ctx.db.insert("conversations", {
      type: "group",
      name: args.name.trim(),
      createdBy: userId,
      inviteCode,
    });

    const now = Date.now();
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

    await insertSystemMessage(
      ctx,
      conversationId,
      userId,
      `${await displayNameOf(ctx, userId)} a créé le groupe`
    );

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

    const membership = await getMembership(
      ctx,
      args.conversationId,
      currentUserId
    );
    if (!membership) throw new Error("Not a member of this conversation");

    const existingMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
    const existingIds = new Set(existingMembers.map((m) => m.userId));

    const toAdd = [...new Set(args.userIds)].filter(
      (id) => !existingIds.has(id)
    );
    if (existingMembers.length + toAdd.length > MAX_GROUP_MEMBERS) {
      throw new Error("Group is limited to 100 members");
    }

    const now = Date.now();
    const addedNames: string[] = [];
    for (const userId of toAdd) {
      const user = await ctx.db.get(userId);
      if (!user) throw new Error("User not found");
      addedNames.push(
        user.displayName ?? user.name ?? user.username ?? "Quelqu'un"
      );
      await ctx.db.insert("conversationMembers", {
        conversationId: args.conversationId,
        userId,
        role: "member",
        joinedAt: now,
      });
    }

    if (addedNames.length > 0) {
      await insertSystemMessage(
        ctx,
        args.conversationId,
        currentUserId,
        `${await displayNameOf(ctx, currentUserId)} a ajouté ${addedNames.join(", ")}`
      );
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

    if (!args.name.trim()) throw new Error("Group name is required");
    if (args.name.length > 100) throw new Error("Group name too long");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "group") {
      throw new Error("Only groups can be renamed");
    }

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can rename the group");
    }

    const newName = args.name.trim();
    if (newName === conversation.name) return;

    await ctx.db.patch(args.conversationId, { name: newName });
    await insertSystemMessage(
      ctx,
      args.conversationId,
      userId,
      `${await displayNameOf(ctx, userId)} a renommé le groupe en « ${newName} »`
    );
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

    const currentMembership = await getMembership(
      ctx,
      args.conversationId,
      currentUserId
    );
    if (!currentMembership || currentMembership.role !== "admin") {
      throw new Error("Only admins can change roles");
    }

    const targetMembership = await getMembership(
      ctx,
      args.conversationId,
      args.userId
    );
    if (!targetMembership) throw new Error("User is not a member");
    if (targetMembership.role === args.role) return;

    if (args.role === "member") {
      // Never leave the group without an admin
      const members = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .collect();
      const adminCount = members.filter((m) => m.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error("A group must keep at least one admin");
      }
    }

    await ctx.db.patch(targetMembership._id, { role: args.role });

    const actorName = await displayNameOf(ctx, currentUserId);
    const targetName = await displayNameOf(ctx, args.userId);
    await insertSystemMessage(
      ctx,
      args.conversationId,
      currentUserId,
      args.role === "admin"
        ? `${actorName} a nommé ${targetName} admin`
        : `${actorName} a retiré ${targetName} des admins`
    );
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

    await ctx.db.insert("conversationMembers", {
      conversationId: conversation._id,
      userId,
      role: "member",
      joinedAt: Date.now(),
    });

    await insertSystemMessage(
      ctx,
      conversation._id,
      userId,
      `${await displayNameOf(ctx, userId)} a rejoint le groupe`
    );

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

    const currentMembership = await getMembership(
      ctx,
      args.conversationId,
      currentUserId
    );
    if (!currentMembership || currentMembership.role !== "admin") {
      throw new Error("Only admins can remove members");
    }

    const targetMembership = await getMembership(
      ctx,
      args.conversationId,
      args.userId
    );
    if (targetMembership) {
      await ctx.db.delete(targetMembership._id);
      await insertSystemMessage(
        ctx,
        args.conversationId,
        currentUserId,
        `${await displayNameOf(ctx, currentUserId)} a retiré ${await displayNameOf(ctx, args.userId)}`
      );
    }
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

    // Check remaining members
    const remainingMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    if (remainingMembers.length === 0) {
      // Delete orphaned conversation and its messages
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(args.conversationId);
    } else {
      await insertSystemMessage(
        ctx,
        args.conversationId,
        userId,
        `${await displayNameOf(ctx, userId)} a quitté le groupe`
      );
      const hasAdmin = remainingMembers.some((m) => m.role === "admin");
      if (membership.role === "admin" && !hasAdmin) {
        // Promote next member if the last admin leaves
        const nextMember = remainingMembers[0];
        if (nextMember) {
          await ctx.db.patch(nextMember._id, { role: "admin" });
          await insertSystemMessage(
            ctx,
            args.conversationId,
            nextMember.userId,
            `${await displayNameOf(ctx, nextMember.userId)} est désormais admin`
          );
        }
      }
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
