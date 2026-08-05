import { describe, expect, it } from "vitest";
import type { ResolvedSystemMessage } from "../../convex/helpers";
import {
	formatConversationPreview,
	formatSystemMessage,
} from "./system-message";

function system(
	overrides: Partial<ResolvedSystemMessage> &
		Pick<ResolvedSystemMessage, "kind">,
): ResolvedSystemMessage {
	return { actorName: "lucas", targetNames: [], ...overrides };
}

describe("formatSystemMessage", () => {
	it("names the actor who created the group", () => {
		expect(formatSystemMessage(system({ kind: "group_created" }))).toBe(
			"lucas a créé le groupe",
		);
	});

	it("quotes the new name on a rename", () => {
		expect(
			formatSystemMessage(
				system({ kind: "group_renamed", groupName: "Vacances 2027" }),
			),
		).toBe("lucas a renommé le groupe en « Vacances 2027 »");
	});

	it("lists a single newcomer", () => {
		expect(
			formatSystemMessage(
				system({ kind: "members_added", targetNames: ["camille"] }),
			),
		).toBe("lucas a ajouté camille");
	});

	it("joins the last two newcomers with 'et'", () => {
		expect(
			formatSystemMessage(
				system({
					kind: "members_added",
					targetNames: ["camille", "sofia", "eliott"],
				}),
			),
		).toBe("lucas a ajouté camille, sofia et eliott");
	});

	it("falls back to a neutral noun when the actor is gone", () => {
		expect(
			formatSystemMessage(system({ kind: "member_left", actorName: null })),
		).toBe("Quelqu'un a quitté le groupe");
	});

	it("falls back to a neutral noun when no target survives", () => {
		expect(
			formatSystemMessage(system({ kind: "member_removed", targetNames: [] })),
		).toBe("lucas a retiré Quelqu'un");
	});

	it("renders the sentence stored by an older version when there is no payload", () => {
		expect(formatSystemMessage(null, "lucas a créé le groupe")).toBe(
			"lucas a créé le groupe",
		);
	});

	it("renders nothing when there is neither payload nor legacy sentence", () => {
		expect(formatSystemMessage(null)).toBe("");
	});

	it.each([
		["member_joined", "lucas a rejoint le groupe"],
		["role_granted", "lucas a nommé camille admin"],
		["role_revoked", "lucas a retiré camille des admins"],
		["admin_promoted", "lucas est désormais admin"],
	] as const)("phrases %s", (kind, expected) => {
		expect(
			formatSystemMessage(system({ kind, targetNames: ["camille"] })),
		).toBe(expected);
	});
});

describe("formatConversationPreview", () => {
	it("invites the user to start when there is no message yet", () => {
		expect(formatConversationPreview(null)).toBe("Nouvelle conversation");
	});

	it("shows the text of a plain message", () => {
		expect(
			formatConversationPreview({
				type: "text",
				content: "Salut",
				callType: null,
				system: null,
			}),
		).toBe("Salut");
	});

	it("labels a video call", () => {
		expect(
			formatConversationPreview({
				type: "call",
				content: "",
				callType: "video",
				system: null,
			}),
		).toBe("Appel vidéo");
	});

	it("labels an audio call", () => {
		expect(
			formatConversationPreview({
				type: "call",
				content: "",
				callType: "audio",
				system: null,
			}),
		).toBe("Appel audio");
	});

	it("renders a system message rather than its empty content", () => {
		expect(
			formatConversationPreview({
				type: "system",
				content: "",
				callType: null,
				system: system({ kind: "group_created" }),
			}),
		).toBe("lucas a créé le groupe");
	});
});
