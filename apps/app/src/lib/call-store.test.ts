import { beforeEach, describe, expect, it } from "vitest";
import { useCallStore } from "./call-store";

const s = () => useCallStore.getState();

describe("call-store phase machine", () => {
	beforeEach(() => {
		s().reset();
	});

	it("starts idle with no call", () => {
		expect(s().phase).toBe("idle");
		expect(s().callId).toBeNull();
		expect(s().direction).toBeNull();
	});

	it("startCall -> calling / outgoing, camera off for audio", () => {
		s().startCall("call1", "conv1", "audio");
		expect(s().phase).toBe("calling");
		expect(s().direction).toBe("outgoing");
		expect(s().callId).toBe("call1");
		expect(s().conversationId).toBe("conv1");
		expect(s().callType).toBe("audio");
		expect(s().isCameraOff).toBe(true);
	});

	it("startCall keeps camera on for video", () => {
		s().startCall("call1", "conv1", "video");
		expect(s().isCameraOff).toBe(false);
	});

	it("receiveCall -> ringing / incoming", () => {
		s().receiveCall("call2", "conv2", "video");
		expect(s().phase).toBe("ringing");
		expect(s().direction).toBe("incoming");
		expect(s().callId).toBe("call2");
	});

	it("connecting -> connected sets startedAt once (idempotent)", () => {
		s().startCall("call1", "conv1", "video");
		s().setConnecting();
		expect(s().phase).toBe("connecting");
		expect(s().startedAt).toBeNull();

		s().setConnected();
		expect(s().phase).toBe("connected");
		const t = s().startedAt;
		expect(t).not.toBeNull();

		s().setConnected();
		expect(s().startedAt).toBe(t); // not reset on re-entry
	});

	it("endCall moves to ended and records the reason", () => {
		s().startCall("call1", "conv1", "audio");
		s().endCall("Aucune réponse");
		expect(s().phase).toBe("ended");
		expect(s().error).toBe("Aucune réponse");
	});

	it("reset returns to a clean idle state", () => {
		s().startCall("call1", "conv1", "video");
		s().setConnected();
		s().setMuted(true);
		s().reset();
		expect(s().phase).toBe("idle");
		expect(s().callId).toBeNull();
		expect(s().remoteStream).toBeNull();
		expect(s().isMuted).toBe(false);
		expect(s().startedAt).toBeNull();
	});

	it("media toggles set explicit boolean state", () => {
		s().setMuted(true);
		expect(s().isMuted).toBe(true);
		s().setCameraOff(true);
		expect(s().isCameraOff).toBe(true);
		s().setScreenSharing(true);
		expect(s().isScreenSharing).toBe(true);
	});
});
