import type { ResolvedSystemMessage } from "../../convex/helpers";

/**
 * Wording for system messages ("X a créé le groupe", …).
 *
 * The backend stores only `{ kind, actorId, targetIds }` and resolves the ids to
 * names; the sentence is built here. That way history stays translatable — a
 * timeline of pre-rendered French sentences in the database never could be.
 */

const UNKNOWN_ACTOR = "Quelqu'un";

function nameList(names: string[]): string {
	if (names.length === 0) return UNKNOWN_ACTOR;
	if (names.length === 1) return names[0] as string;
	const head = names.slice(0, -1).join(", ");
	return `${head} et ${names[names.length - 1]}`;
}

export function formatSystemMessage(
	system: ResolvedSystemMessage | null,
	/** Sentence stored by an older version of the app, used when `system` is absent. */
	legacyContent?: string,
): string {
	if (!system) return legacyContent ?? "";

	const actor = system.actorName ?? UNKNOWN_ACTOR;
	const targets = nameList(system.targetNames);

	switch (system.kind) {
		case "group_created":
			return `${actor} a créé le groupe`;
		case "group_renamed":
			return `${actor} a renommé le groupe en « ${system.groupName ?? ""} »`;
		case "members_added":
			return `${actor} a ajouté ${targets}`;
		case "member_removed":
			return `${actor} a retiré ${targets}`;
		case "member_joined":
			return `${actor} a rejoint le groupe`;
		case "member_left":
			return `${actor} a quitté le groupe`;
		case "role_granted":
			return `${actor} a nommé ${targets} admin`;
		case "role_revoked":
			return `${actor} a retiré ${targets} des admins`;
		case "admin_promoted":
			return `${actor} est désormais admin`;
	}
}

interface ConversationPreview {
	type: "text" | "call" | "system";
	content: string;
	callType: "audio" | "video" | null;
	system: ResolvedSystemMessage | null;
}

/** One-line preview of the latest message, for the conversation list. */
export function formatConversationPreview(
	message: ConversationPreview | null,
): string {
	if (!message) return "Nouvelle conversation";

	switch (message.type) {
		case "system":
			return formatSystemMessage(message.system, message.content);
		case "call":
			return message.callType === "video" ? "Appel vidéo" : "Appel audio";
		default:
			return message.content;
	}
}
