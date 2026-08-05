import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	asUser,
	seedDm,
	seedGroup,
	seedUser,
	setupTest,
	type TestConvex,
} from "./test.setup";

/** A DM between lucas and camille, with an audio call already ringing. */
async function ringingCall(t: TestConvex, type: "audio" | "video" = "audio") {
	const lucas = await seedUser(t, "lucas");
	const camille = await seedUser(t, "camille");
	const conversationId = await seedDm(t, lucas, camille);
	const callId = await asUser(t, lucas).mutation(api.calls.initiate, {
		conversationId,
		type,
	});
	return { lucas, camille, conversationId, callId };
}

async function callStatus(t: TestConvex, callId: Id<"calls">) {
	return await t.run(async (ctx) => (await ctx.db.get(callId))?.status);
}

async function participantStatus(
	t: TestConvex,
	callId: Id<"calls">,
	userId: Id<"users">,
) {
	return await t.run(async (ctx) => {
		const participant = await ctx.db
			.query("callParticipants")
			.withIndex("by_call_user", (q) =>
				q.eq("callId", callId).eq("userId", userId),
			)
			.unique();
		return participant?.status;
	});
}

describe("calls.initiate", () => {
	it("starts the call ringing with the caller already joined", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);

		expect(await callStatus(t, callId)).toBe("ringing");
		expect(await participantStatus(t, callId, lucas)).toBe("joined");
		expect(await participantStatus(t, callId, camille)).toBe("ringing");
	});

	it("starts an audio call with the camera off", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t, "audio");

		const participants = await asUser(t, lucas).query(api.calls.participants, {
			callId,
		});
		expect(participants.every((p) => p.isCameraOff)).toBe(true);
	});

	it("starts a video call with the camera on", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t, "video");

		const participants = await asUser(t, lucas).query(api.calls.participants, {
			callId,
		});
		expect(participants.every((p) => p.isCameraOff)).toBe(false);
	});

	it("refuses to call a group", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const { conversationId } = await seedGroup(t, lucas, "Vacances", [camille]);

		await expect(
			asUser(t, lucas).mutation(api.calls.initiate, {
				conversationId,
				type: "audio",
			}),
		).rejects.toThrow(/only supported in direct messages/);
	});

	it("refuses a caller who is not in the conversation", async () => {
		const t = setupTest();
		const lucas = await seedUser(t, "lucas");
		const camille = await seedUser(t, "camille");
		const outsider = await seedUser(t, "outsider");
		const conversationId = await seedDm(t, lucas, camille);

		await expect(
			asUser(t, outsider).mutation(api.calls.initiate, {
				conversationId,
				type: "audio",
			}),
		).rejects.toThrow(/Not a member/);
	});

	it("refuses a second call while one is already live", async () => {
		const t = setupTest();
		const { camille, conversationId } = await ringingCall(t);

		await expect(
			asUser(t, camille).mutation(api.calls.initiate, {
				conversationId,
				type: "audio",
			}),
		).rejects.toThrow(/already in progress/);
	});

	it("allows a new call once the previous one ended", async () => {
		const t = setupTest();
		const { lucas, conversationId, callId } = await ringingCall(t);
		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		await expect(
			asUser(t, lucas).mutation(api.calls.initiate, {
				conversationId,
				type: "audio",
			}),
		).resolves.toBeDefined();
	});
});

describe("calls.accept", () => {
	it("makes the call active", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);

		await asUser(t, camille).mutation(api.calls.accept, { callId });

		expect(await callStatus(t, callId)).toBe("active");
		expect(await participantStatus(t, callId, camille)).toBe("joined");
	});

	it("ignores a second accept on an already active call", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);
		await asUser(t, camille).mutation(api.calls.accept, { callId });

		await asUser(t, camille).mutation(api.calls.accept, { callId });

		expect(await callStatus(t, callId)).toBe("active");
	});

	it("refuses somebody who is not on the call", async () => {
		const t = setupTest();
		const { callId } = await ringingCall(t);
		const outsider = await seedUser(t, "outsider");

		await expect(
			asUser(t, outsider).mutation(api.calls.accept, { callId }),
		).rejects.toThrow(/Not a participant/);
	});
});

describe("calls.decline", () => {
	it("ends the call as declined", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);

		await asUser(t, camille).mutation(api.calls.decline, { callId });

		expect(await callStatus(t, callId)).toBe("declined");
		expect(await participantStatus(t, callId, camille)).toBe("declined");
	});

	it("leaves a call record in the conversation timeline", async () => {
		const t = setupTest();
		const { camille, conversationId, callId } = await ringingCall(t);

		await asUser(t, camille).mutation(api.calls.decline, { callId });

		const messages = await t.run(async (ctx) =>
			ctx.db
				.query("messages")
				.withIndex("by_conversation", (q) =>
					q.eq("conversationId", conversationId),
				)
				.collect(),
		);
		expect(messages.at(-1)?.callData).toMatchObject({
			callId,
			callType: "audio",
			status: "declined",
		});
	});
});

describe("calls.hangup", () => {
	it("marks the call as missed when the caller gives up before an answer", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);

		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		expect(await callStatus(t, callId)).toBe("missed");
		expect(await participantStatus(t, callId, camille)).toBe("missed");
	});

	it("marks the call as ended once it was answered", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, camille).mutation(api.calls.accept, { callId });

		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		expect(await callStatus(t, callId)).toBe("ended");
	});

	it("records how long the call lasted", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, camille).mutation(api.calls.accept, { callId });

		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		const call = await t.run(async (ctx) => ctx.db.get(callId));
		expect(call?.duration).toBeTypeOf("number");
	});

	it("is idempotent", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, camille).mutation(api.calls.accept, { callId });
		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		expect(await callStatus(t, callId)).toBe("ended");
	});
});

describe("calls.timeout", () => {
	it("lets the caller mark an unanswered call as missed", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t);

		await asUser(t, lucas).mutation(api.calls.timeout, { callId });

		expect(await callStatus(t, callId)).toBe("missed");
	});

	it("refuses the callee", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);

		await expect(
			asUser(t, camille).mutation(api.calls.timeout, { callId }),
		).rejects.toThrow(/Only the caller/);
	});

	it("does nothing once the call was answered", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, camille).mutation(api.calls.accept, { callId });

		await asUser(t, lucas).mutation(api.calls.timeout, { callId });

		expect(await callStatus(t, callId)).toBe("active");
	});
});

describe("calls.updateParticipantMedia", () => {
	it("records the mute state", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t);

		await asUser(t, lucas).mutation(api.calls.updateParticipantMedia, {
			callId,
			isMuted: true,
		});

		const participants = await asUser(t, lucas).query(api.calls.participants, {
			callId,
		});
		expect(participants.find((p) => p.userId === lucas)?.isMuted).toBe(true);
	});

	it("leaves untouched flags alone", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t, "video");

		await asUser(t, lucas).mutation(api.calls.updateParticipantMedia, {
			callId,
			isMuted: true,
		});

		const participants = await asUser(t, lucas).query(api.calls.participants, {
			callId,
		});
		expect(participants.find((p) => p.userId === lucas)?.isCameraOff).toBe(
			false,
		);
	});

	it("refuses somebody who is not on the call", async () => {
		const t = setupTest();
		const { callId } = await ringingCall(t);
		const outsider = await seedUser(t, "outsider");

		await expect(
			asUser(t, outsider).mutation(api.calls.updateParticipantMedia, {
				callId,
				isMuted: true,
			}),
		).rejects.toThrow(/Not a participant/);
	});
});

describe("calls signaling", () => {
	it("delivers a signal to the addressed peer only", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);

		await asUser(t, lucas).mutation(api.calls.sendSignal, {
			callId,
			toUserId: camille,
			type: "offer",
			payload: "v=0",
		});

		expect(
			await asUser(t, camille).query(api.calls.pendingSignals, { callId }),
		).toHaveLength(1);
		expect(
			await asUser(t, lucas).query(api.calls.pendingSignals, { callId }),
		).toHaveLength(0);
	});

	it("rejects a payload larger than 100KB", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);

		await expect(
			asUser(t, lucas).mutation(api.calls.sendSignal, {
				callId,
				toUserId: camille,
				type: "offer",
				payload: "a".repeat(100_001),
			}),
		).rejects.toThrow(/payload too large/);
	});

	it("rejects a signal addressed to oneself", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t);

		await expect(
			asUser(t, lucas).mutation(api.calls.sendSignal, {
				callId,
				toUserId: lucas,
				type: "offer",
				payload: "v=0",
			}),
		).rejects.toThrow(/Invalid signal recipient/);
	});

	it("rejects a signal addressed to somebody outside the call", async () => {
		const t = setupTest();
		const { lucas, callId } = await ringingCall(t);
		const outsider = await seedUser(t, "outsider");

		await expect(
			asUser(t, lucas).mutation(api.calls.sendSignal, {
				callId,
				toUserId: outsider,
				type: "offer",
				payload: "v=0",
			}),
		).rejects.toThrow(/Invalid signal recipient/);
	});

	it("rejects a sender who is not on the call", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);
		const outsider = await seedUser(t, "outsider");

		await expect(
			asUser(t, outsider).mutation(api.calls.sendSignal, {
				callId,
				toUserId: camille,
				type: "offer",
				payload: "v=0",
			}),
		).rejects.toThrow(/Not a participant/);
	});

	it("rejects signaling on a call that already ended", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		await expect(
			asUser(t, lucas).mutation(api.calls.sendSignal, {
				callId,
				toUserId: camille,
				type: "offer",
				payload: "v=0",
			}),
		).rejects.toThrow(/not active/);
	});

	it("deletes a signal once its addressee consumed it", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, lucas).mutation(api.calls.sendSignal, {
			callId,
			toUserId: camille,
			type: "offer",
			payload: "v=0",
		});
		const [signal] = await asUser(t, camille).query(api.calls.pendingSignals, {
			callId,
		});

		await asUser(t, camille).mutation(api.calls.consumeSignals, {
			signalIds: [signal._id],
		});

		expect(
			await asUser(t, camille).query(api.calls.pendingSignals, { callId }),
		).toEqual([]);
	});

	it("ignores an attempt to consume somebody else's signal", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, lucas).mutation(api.calls.sendSignal, {
			callId,
			toUserId: camille,
			type: "offer",
			payload: "v=0",
		});
		const [signal] = await asUser(t, camille).query(api.calls.pendingSignals, {
			callId,
		});

		await asUser(t, lucas).mutation(api.calls.consumeSignals, {
			signalIds: [signal._id],
		});

		expect(
			await asUser(t, camille).query(api.calls.pendingSignals, { callId }),
		).toHaveLength(1);
	});

	it("clears leftover signals when the call ends", async () => {
		const t = setupTest();
		const { lucas, camille, callId } = await ringingCall(t);
		await asUser(t, lucas).mutation(api.calls.sendSignal, {
			callId,
			toUserId: camille,
			type: "offer",
			payload: "v=0",
		});

		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		expect(
			await t.run(async (ctx) => ctx.db.query("callSignaling").collect()),
		).toEqual([]);
	});
});

describe("calls.activeCall", () => {
	it("reports the live call of the conversation", async () => {
		const t = setupTest();
		const { camille, conversationId, callId } = await ringingCall(t);

		const call = await asUser(t, camille).query(api.calls.activeCall, {
			conversationId,
		});

		expect(call?._id).toBe(callId);
	});

	it("reports nothing once the call ended", async () => {
		const t = setupTest();
		const { lucas, conversationId, callId } = await ringingCall(t);
		await asUser(t, lucas).mutation(api.calls.hangup, { callId });

		expect(
			await asUser(t, lucas).query(api.calls.activeCall, { conversationId }),
		).toBeNull();
	});

	it("reports nothing to somebody outside the conversation", async () => {
		const t = setupTest();
		const { conversationId } = await ringingCall(t);
		const outsider = await seedUser(t, "outsider");

		expect(
			await asUser(t, outsider).query(api.calls.activeCall, { conversationId }),
		).toBeNull();
	});
});

describe("calls.participants", () => {
	it("returns nothing to somebody who is not on the call", async () => {
		const t = setupTest();
		const { callId } = await ringingCall(t);
		const outsider = await seedUser(t, "outsider");

		expect(
			await asUser(t, outsider).query(api.calls.participants, { callId }),
		).toEqual([]);
	});
});

describe("calls.incomingCall", () => {
	it("notifies the callee of a ringing call", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);

		const incoming = await asUser(t, camille).query(api.calls.incomingCall, {});

		expect(incoming?.call._id).toBe(callId);
		expect(incoming?.initiator?.username).toBe("lucas");
	});

	it("never notifies the caller of their own call", async () => {
		const t = setupTest();
		const { lucas } = await ringingCall(t);

		expect(await asUser(t, lucas).query(api.calls.incomingCall, {})).toBeNull();
	});

	it("stops notifying once the call was declined", async () => {
		const t = setupTest();
		const { camille, callId } = await ringingCall(t);
		await asUser(t, camille).mutation(api.calls.decline, { callId });

		expect(
			await asUser(t, camille).query(api.calls.incomingCall, {}),
		).toBeNull();
	});

	it("returns nothing when nobody is signed in", async () => {
		const t = setupTest();
		await ringingCall(t);

		expect(await t.query(api.calls.incomingCall, {})).toBeNull();
	});
});
