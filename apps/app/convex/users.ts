import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("File not found");
    await ctx.db.patch(userId, { image: url });
    return url;
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const updateProfile = mutation({
  args: {
    username: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.username.length < 3 || args.username.length > 20) {
      throw new Error("Username must be 3-20 characters");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(args.username)) {
      throw new Error("Username can only contain letters, numbers, and underscores");
    }
    if (args.bio && args.bio.length > 160) {
      throw new Error("Bio must be 160 characters or less");
    }
    if (args.displayName && args.displayName.length > 50) {
      throw new Error("Display name must be 50 characters or less");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    if (existing && existing._id !== userId) {
      throw new Error("Username already taken");
    }

    await ctx.db.patch(userId, {
      username: args.username,
      displayName: args.displayName,
      bio: args.bio,
    });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, { onboardingCompleted: true });
  },
});

export const setOnlineStatus = mutation({
  args: { isOnline: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    await ctx.db.patch(userId, {
      isOnline: args.isOnline,
      lastSeenAt: Date.now(),
    });
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (args.query.length < 2) return [];

    const allUsers = await ctx.db.query("users").collect();
    return allUsers
      .filter(
        (u) =>
          u._id !== userId &&
          u.username &&
          u.username.toLowerCase().includes(args.query.toLowerCase())
      )
      .slice(0, 10)
      .map((u) => ({
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        name: u.name,
        image: u.image,
        isOnline: u.isOnline ?? false,
      }));
  },
});
