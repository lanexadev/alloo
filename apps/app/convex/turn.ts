"use node";

import { createHmac } from "node:crypto";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "./_generated/server";

/**
 * ICE server configuration for WebRTC calls.
 *
 * STUN alone only works when at least one peer can be reached directly. Behind
 * symmetric NAT or a corporate firewall — a non-trivial share of users — the
 * connection never establishes without a TURN relay, so TURN credentials are
 * minted here rather than shipped to the client.
 *
 * Credentials follow the coturn / RFC 5766 REST API scheme: the username is
 * `<unix-expiry>:<userId>` and the credential is
 * `base64(HMAC-SHA1(static-auth-secret, username))`. They are short-lived and
 * the shared secret never leaves the server.
 *
 * Configure on the Convex deployment (`npx convex env set …`):
 *   TURN_URLS         comma-separated, e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"
 *   TURN_SECRET       coturn's `static-auth-secret`
 *   TURN_TTL_SECONDS  optional, credential lifetime (default 3600)
 *   STUN_URLS         optional, comma-separated override of the STUN defaults
 *
 * With TURN_URLS or TURN_SECRET unset, calls fall back to STUN only — fine for
 * local development, not for production.
 */

const DEFAULT_STUN_URLS = [
	"stun:stun.l.google.com:19302",
	"stun:stun1.l.google.com:19302",
];

const DEFAULT_TTL_SECONDS = 3600;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 86_400;

export interface IceServer {
	urls: string[];
	username?: string;
	credential?: string;
}

function parseUrlList(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((url) => url.trim())
		.filter((url) => url.length > 0);
}

function resolveTtlSeconds(): number {
	const raw = process.env.TURN_TTL_SECONDS;
	if (!raw) return DEFAULT_TTL_SECONDS;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS;
	return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, parsed));
}

export const getIceServers = action({
	args: {},
	handler: async (
		ctx,
	): Promise<{ iceServers: IceServer[]; hasTurn: boolean }> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Not authenticated");

		const stunUrls = parseUrlList(process.env.STUN_URLS);
		const iceServers: IceServer[] = [
			{ urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS },
		];

		const turnUrls = parseUrlList(process.env.TURN_URLS);
		const turnSecret = process.env.TURN_SECRET;

		if (turnUrls.length === 0 || !turnSecret) {
			return { iceServers, hasTurn: false };
		}

		const expiry = Math.floor(Date.now() / 1000) + resolveTtlSeconds();
		const username = `${expiry}:${userId}`;
		const credential = createHmac("sha1", turnSecret)
			.update(username)
			.digest("base64");

		iceServers.push({ urls: turnUrls, username, credential });
		return { iceServers, hasTurn: true };
	},
});
