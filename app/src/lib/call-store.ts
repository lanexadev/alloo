import { create } from "zustand";

/**
 * 1:1 call phase machine.
 *   idle       — no call
 *   calling    — outgoing, waiting for the callee to answer (ringback)
 *   ringing    — incoming, waiting for the local user to answer
 *   connecting — answered, WebRTC negotiation in progress
 *   connected  — remote media flowing
 *   ended      — terminal, shown briefly then reset to idle
 */
export type CallPhase =
	| "idle"
	| "calling"
	| "ringing"
	| "connecting"
	| "connected"
	| "ended";

export type CallType = "audio" | "video";
export type CallDirection = "incoming" | "outgoing";

interface CallState {
	phase: CallPhase;
	callId: string | null;
	conversationId: string | null;
	callType: CallType | null;
	direction: CallDirection | null;
	startedAt: number | null;
	isMuted: boolean;
	isCameraOff: boolean;
	isScreenSharing: boolean;
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	error: string | null;

	startCall: (callId: string, conversationId: string, type: CallType) => void;
	receiveCall: (callId: string, conversationId: string, type: CallType) => void;
	setConnecting: () => void;
	setConnected: () => void;
	endCall: (reason?: string) => void;
	reset: () => void;
	setMuted: (muted: boolean) => void;
	setCameraOff: (off: boolean) => void;
	setScreenSharing: (sharing: boolean) => void;
	setLocalStream: (stream: MediaStream | null) => void;
	setRemoteStream: (stream: MediaStream | null) => void;
}

const initialState = {
	phase: "idle" as CallPhase,
	callId: null as string | null,
	conversationId: null as string | null,
	callType: null as CallType | null,
	direction: null as CallDirection | null,
	startedAt: null as number | null,
	isMuted: false,
	isCameraOff: false,
	isScreenSharing: false,
	localStream: null as MediaStream | null,
	remoteStream: null as MediaStream | null,
	error: null as string | null,
};

export const useCallStore = create<CallState>((set) => ({
	...initialState,

	startCall: (callId, conversationId, callType) =>
		set({
			phase: "calling",
			callId,
			conversationId,
			callType,
			direction: "outgoing",
			isCameraOff: callType === "audio",
			error: null,
		}),

	receiveCall: (callId, conversationId, callType) =>
		set({
			phase: "ringing",
			callId,
			conversationId,
			callType,
			direction: "incoming",
			isCameraOff: callType === "audio",
			error: null,
		}),

	setConnecting: () => set({ phase: "connecting" }),

	setConnected: () =>
		set((state) =>
			state.phase === "connected"
				? state
				: { phase: "connected", startedAt: state.startedAt ?? Date.now() },
		),

	endCall: (reason) => set({ phase: "ended", error: reason ?? null }),

	reset: () => set({ ...initialState, remoteStream: null }),

	setMuted: (isMuted) => set({ isMuted }),
	setCameraOff: (isCameraOff) => set({ isCameraOff }),
	setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
	setLocalStream: (localStream) => set({ localStream }),
	setRemoteStream: (remoteStream) => set({ remoteStream }),
}));
