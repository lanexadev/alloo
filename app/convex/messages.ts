import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

async function getTypingEntry(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const entries = await ctx.db
    .query("typingIndicators")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  return entries.find((e) => e.userId === userId) ?? null;
}

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return [];

    // Get other members' lastReadAt for read receipts
    const allMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
    const otherMembers = allMembers.filter((m) => m.userId !== userId);

    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    // Hide messages the user deleted for themselves
    const messages = allMessages.filter(
      (msg) => !msg.deletedFor?.includes(userId)
    );

    // Lookup table for reply previews (replied message may itself be hidden
    // for this user — the preview is still shown, like in other messengers)
    const messageById = new Map(allMessages.map((m) => [m._id, m]));

    // Deduplicate sender lookups
    const senderCache = new Map<string, {
      _id: Id<"users">;
      username?: string;
      displayName?: string;
      name?: string;
      image?: string;
    } | null>();

    const messagesWithSender = await Promise.all(
      messages.map(async (msg) => {
        const senderId = msg.senderId as Id<"users">;
        if (!senderCache.has(senderId)) {
          const sender = await ctx.db.get(senderId);
          senderCache.set(
            senderId,
            sender
              ? {
                  _id: sender._id as Id<"users">,
                  username: sender.username,
                  displayName: sender.displayName,
                  name: sender.name,
                  image: sender.image,
                }
              : null
          );
        }
        const isOwn = senderId === userId;

        // Reactions grouped by emoji
        const reactionDocs = await ctx.db
          .query("messageReactions")
          .withIndex("by_message", (q) => q.eq("messageId", msg._id))
          .collect();
        const reactionGroups = new Map<
          string,
          { emoji: string; count: number; reactedByMe: boolean }
        >();
        for (const r of reactionDocs) {
          const group = reactionGroups.get(r.emoji) ?? {
            emoji: r.emoji,
            count: 0,
            reactedByMe: false,
          };
          group.count += 1;
          if (r.userId === userId) group.reactedByMe = true;
          reactionGroups.set(r.emoji, group);
        }

        // Reply preview
        let replyTo = null;
        if (msg.replyToId) {
          const replied =
            messageById.get(msg.replyToId) ?? (await ctx.db.get(msg.replyToId));
          if (replied) {
            const repliedSender = await ctx.db.get(
              replied.senderId as Id<"users">
            );
            replyTo = {
              _id: replied._id,
              content: replied.content,
              senderName:
                repliedSender?.displayName ??
                repliedSender?.name ??
                repliedSender?.username ??
                "Inconnu",
              isOwn: replied.senderId === userId,
            };
          }
        }

        // Read receipt: check if all other members have read past this message
        const isRead = isOwn
          ? otherMembers.length > 0 &&
            otherMembers.every(
              (m) => m.lastReadAt != null && m.lastReadAt >= msg._creationTime
            )
          : false;

        return {
          ...msg,
          sender: senderCache.get(senderId) ?? null,
          isOwn,
          isRead,
          reactions: [...reactionGroups.values()],
          replyTo,
        };
      })
    );

    return messagesWithSender;
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

    if (!args.content.trim()) throw new Error("Message cannot be empty");
    if (args.content.length > 4000) throw new Error("Message too long");

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) throw new Error("Not a member of this conversation");

    if (args.replyToId) {
      const replied = await ctx.db.get(args.replyToId);
      if (!replied || replied.conversationId !== args.conversationId) {
        throw new Error("Replied message not found in this conversation");
      }
    }

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: userId,
      content: args.content.trim(),
      replyToId: args.replyToId,
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });

    const typing = await getTypingEntry(ctx, args.conversationId, userId);
    if (typing) await ctx.db.delete(typing._id);
  },
});

async function getAccessibleMessage(
  ctx: QueryCtx | MutationCtx,
  messageId: Id<"messages">,
  userId: Id<"users">
) {
  const message = await ctx.db.get(messageId);
  if (!message) throw new Error("Message not found");
  const membership = await getMembership(ctx, message.conversationId, userId);
  if (!membership) throw new Error("Not a member of this conversation");
  return message;
}

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!args.emoji.trim() || args.emoji.length > 16) {
      throw new Error("Invalid emoji");
    }

    await getAccessibleMessage(ctx, args.messageId, userId);

    // One reaction per user per message: same emoji toggles off,
    // a different emoji replaces the previous one.
    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId)
      )
      .unique();

    if (existing && existing.emoji === args.emoji) {
      await ctx.db.delete(existing._id);
      return;
    }
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("messageReactions", {
      messageId: args.messageId,
      userId,
      emoji: args.emoji,
    });
  },
});

export const deleteForMe = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await getAccessibleMessage(ctx, args.messageId, userId);
    const deletedFor = message.deletedFor ?? [];
    if (!deletedFor.includes(userId)) {
      await ctx.db.patch(args.messageId, {
        deletedFor: [...deletedFor, userId],
      });
    }
  },
});

export const togglePin = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await getAccessibleMessage(ctx, args.messageId, userId);
    if (message.pinnedAt != null) {
      await ctx.db.patch(args.messageId, {
        pinnedAt: undefined,
        pinnedBy: undefined,
      });
    } else {
      await ctx.db.patch(args.messageId, {
        pinnedAt: Date.now(),
        pinnedBy: userId,
      });
    }
  },
});

export const listPinned = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const pinned = messages
      .filter(
        (m) => m.pinnedAt != null && !m.deletedFor?.includes(userId)
      )
      .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));

    return Promise.all(
      pinned.map(async (m) => {
        const sender = await ctx.db.get(m.senderId as Id<"users">);
        return {
          _id: m._id,
          content: m.content,
          pinnedAt: m.pinnedAt as number,
          senderName:
            sender?.displayName ??
            sender?.name ??
            sender?.username ??
            "Inconnu",
        };
      })
    );
  },
});

export const setTyping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Verify membership
    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return;

    const existing = await getTypingEntry(ctx, args.conversationId, userId);
    const expiresAt = Date.now() + 3000;

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

    // Verify membership
    const membership = await getMembership(ctx, args.conversationId, userId);
    if (!membership) return [];

    const now = Date.now();
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const activeTypers = indicators.filter(
      (i) => i.userId !== userId && i.expiresAt > now
    );

    const users = await Promise.all(
      activeTypers.map(async (i) => {
        const user = await ctx.db.get(i.userId as Id<"users">);
        return user?.username ?? user?.name ?? "Someone";
      })
    );

    return users;
  },
});
