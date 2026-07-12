"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCallStore } from "@/lib/call-store";
import { WebRTCManager } from "@/lib/webrtc-manager";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

const RING_TIMEOUT_MS = 30_000;

/**
 * Orchestrates a 1:1 call: wires the Convex reactive queries/mutations to the
 * WebRTC manager and the Zustand phase machine. Exactly one peer connection.
 */
export function useCall() {
	const { user } = useCurrentUser();
	const currentUserId = (user?._id ?? null) as Id<"users"> | null;

	// --- store -----------------------------------------------------------------
	const phase = useCallStore((s) => s.phase);
	const callId = useCallStore((s) => s.callId);
	const callType = useCallStore((s) => s.callType);
	const conversationId = useCallStore((s) => s.conversationId);
	const direction = useCallStore((s) => s.direction);
	const startedAt = useCallStore((s) => s.startedAt);
	const isMuted = useCallStore((s) => s.isMuted);
	const isCameraOff = useCallStore((s) => s.isCameraOff);
	const isScreenSharing = useCallStore((s) => s.isScreenSharing);
	const localStream = useCallStore((s) => s.localStream);
	const remoteStream = useCallStore((s) => s.remoteStream);
	const error = useCallStore((s) => s.error);

	// --- mutations -------------------------------------------------------------
	const initiateMutation = useMutation(api.calls.initiate);
	const acceptMutation = useMutation(api.calls.accept);
	const declineMutation = useMutation(api.calls.decline);
	const hangupMutation = useMutation(api.calls.hangup);
	const timeoutMutation = useMutation(api.calls.timeout);
	const updateMediaMutation = useMutation(api.calls.updateParticipantMedia);
	const sendSignalMutation = useMutation(api.calls.sendSignal);
	const consumeSignalsMutation = useMutation(api.calls.consumeSignals);

	const sendSignalRef = useRef(sendSignalMutation);
	useEffect(() => {
		sendSignalRef.current = sendSignalMutation;
	}, [sendSignalMutation]);

	// --- queries ---------------------------------------------------------------
	const incomingCall = useQuery(api.calls.incomingCall);
	const typedCallId = callId as Id<"calls"> | null;
	const activeCall = useQuery(
		api.calls.activeCall,
		conversationId
			? { conversationId: conversationId as Id<"conversations"> }
			: "skip",
	);
	const participants = useQuery(
		api.calls.participants,
		typedCallId ? { callId: typedCallId } : "skip",
	);
	const pendingSignals = useQuery(
		api.calls.pendingSignals,
		typedCallId ? { callId: typedCallId } : "skip",
	);

	// --- refs ------------------------------------------------------------------
	const managerRef = useRef<WebRTCManager | null>(null);
	const peerUserIdRef = useRef<Id<"users"> | null>(null);
	const processedSignalIds = useRef<Set<string>>(new Set());

	const teardown = useCallback(() => {
		managerRef.current?.destroy();
		managerRef.current = null;
		peerUserIdRef.current = null;
		processedSignalIds.current.clear();
	}, []);

	const getOrCreateManager = useCallback((polite: boolean): WebRTCManager => {
		if (managerRef.current) return managerRef.current;
		const manager = new WebRTCManager({
			polite,
			onSignal: (type, payload) => {
				const cId = useCallStore.getState().callId as Id<"calls"> | null;
				const to = peerUserIdRef.current;
				if (!cId || !to) return;
				sendSignalRef
					.current({ callId: cId, toUserId: to, type, payload })
					.catch((err: unknown) =>
						console.error("[call] sendSignal failed:", err),
					);
			},
			onRemoteStream: (stream) => {
				useCallStore.getState().setRemoteStream(stream);
				useCallStore.getState().setConnected();
			},
		});
		managerRef.current = manager;
		return manager;
	}, []);

	// --- resolve the single peer ----------------------------------------------
	useEffect(() => {
		if (!participants || !currentUserId) return;
		const peer = participants.find((p) => p.userId !== currentUserId);
		if (peer) peerUserIdRef.current = peer.userId as Id<"users">;
	}, [participants, currentUserId]);

	const remotePeer = useMemo(() => {
		if (!participants || !currentUserId) return null;
		return participants.find((p) => p.userId !== currentUserId) ?? null;
	}, [participants, currentUserId]);

	// --- incoming call detection ----------------------------------------------
	useEffect(() => {
		if (!incomingCall) return;
		if (useCallStore.getState().phase !== "idle") return;
		useCallStore
			.getState()
			.receiveCall(
				incomingCall.call._id as string,
				incomingCall.call.conversationId as string,
				incomingCall.call.type,
			);
	}, [incomingCall]);

	// --- signal pump -----------------------------------------------------------
	useEffect(() => {
		if (!pendingSignals || pendingSignals.length === 0) return;
		const manager = managerRef.current;
		if (!manager || !peerUserIdRef.current) return; // not ready to negotiate yet

		const fresh = pendingSignals.filter(
			(s) => !processedSignalIds.current.has(s._id as string),
		);
		if (fresh.length === 0) return;
		for (const s of fresh) processedSignalIds.current.add(s._id as string);

		void (async () => {
			for (const signal of fresh) {
				try {
					if (signal.type === "ice-candidate") {
						await manager.handleCandidate(signal.payload);
					} else {
						await manager.handleDescription(signal.payload);
					}
				} catch (err) {
					console.error("[call] signal processing failed:", signal.type, err);
				}
			}
			try {
				await consumeSignalsMutation({
					signalIds: fresh.map((s) => s._id as Id<"callSignaling">),
				});
			} catch (err) {
				console.error("[call] consumeSignals failed:", err);
			}
		})();
	}, [pendingSignals, consumeSignalsMutation]);

	// --- start negotiation once answered + peer resolved -----------------------
	useEffect(() => {
		const manager = managerRef.current;
		const peerId = remotePeer?.userId;
		if (!manager || !peerId) return;

		const readyOutgoing =
			direction === "outgoing" &&
			phase === "calling" &&
			activeCall?.status === "active";
		const readyIncoming = direction === "incoming" && phase === "connecting";

		if (readyOutgoing) useCallStore.getState().setConnecting();
		if (readyOutgoing || readyIncoming) manager.start();
	}, [phase, direction, activeCall, remotePeer]);

	// --- 30s unanswered timeout (caller side) ----------------------------------
	useEffect(() => {
		if (phase !== "calling" || direction !== "outgoing") return;
		const t = setTimeout(() => {
			const state = useCallStore.getState();
			if (state.phase !== "calling" || !state.callId) return;
			timeoutMutation({ callId: state.callId as Id<"calls"> }).catch(() => {});
			teardown();
			state.endCall("Aucune réponse");
		}, RING_TIMEOUT_MS);
		return () => clearTimeout(t);
	}, [phase, direction, timeoutMutation, teardown]);

	// --- remote termination detection ------------------------------------------
	useEffect(() => {
		if (phase === "idle" || phase === "ended") return;

		// Caller cancelled while we were ringing.
		if (
			phase === "ringing" &&
			direction === "incoming" &&
			incomingCall === null
		) {
			teardown();
			useCallStore.getState().endCall("Appel annulé");
			return;
		}
		// Active call ended by the remote party.
		if (
			activeCall === null &&
			conversationId &&
			(phase === "calling" || phase === "connecting" || phase === "connected")
		) {
			teardown();
			useCallStore.getState().endCall();
		}
	}, [activeCall, incomingCall, phase, direction, conversationId, teardown]);

	// --- cleanup & idle reset --------------------------------------------------
	useEffect(() => {
		if (phase === "idle") {
			peerUserIdRef.current = null;
			processedSignalIds.current.clear();
		}
	}, [phase]);

	useEffect(() => () => teardown(), [teardown]);

	// --- actions ---------------------------------------------------------------
	const startCall = useCallback(
		async (targetConversationId: string, type: "audio" | "video") => {
			try {
				const manager = getOrCreateManager(false); // caller = impolite
				const stream = await manager.acquireMedia(type === "video");
				useCallStore.getState().setLocalStream(stream);
				const newCallId = await initiateMutation({
					conversationId: targetConversationId as Id<"conversations">,
					type,
				});
				useCallStore
					.getState()
					.startCall(newCallId as string, targetConversationId, type);
			} catch (err) {
				teardown();
				useCallStore
					.getState()
					.endCall(err instanceof Error ? err.message : "Échec de l'appel");
			}
		},
		[getOrCreateManager, initiateMutation, teardown],
	);

	const acceptCall = useCallback(async () => {
		const state = useCallStore.getState();
		if (!state.callId) return;
		try {
			const manager = getOrCreateManager(true); // callee = polite
			const stream = await manager.acquireMedia(state.callType === "video");
			useCallStore.getState().setLocalStream(stream);
			await acceptMutation({ callId: state.callId as Id<"calls"> });
			useCallStore.getState().setConnecting();
		} catch (err) {
			teardown();
			useCallStore
				.getState()
				.endCall(err instanceof Error ? err.message : "Échec de connexion");
		}
	}, [getOrCreateManager, acceptMutation, teardown]);

	const declineCall = useCallback(async () => {
		const state = useCallStore.getState();
		if (state.callId) {
			await declineMutation({ callId: state.callId as Id<"calls"> }).catch(
				() => {},
			);
		}
		teardown();
		useCallStore.getState().reset();
	}, [declineMutation, teardown]);

	const hangUp = useCallback(async () => {
		const state = useCallStore.getState();
		if (state.callId) {
			await hangupMutation({ callId: state.callId as Id<"calls"> }).catch(
				() => {},
			);
		}
		teardown();
		useCallStore.getState().endCall();
	}, [hangupMutation, teardown]);

	const syncMedia = useCallback(
		(patch: {
			isMuted?: boolean;
			isCameraOff?: boolean;
			isScreenSharing?: boolean;
		}) => {
			const cId = useCallStore.getState().callId;
			if (!cId) return;
			updateMediaMutation({ callId: cId as Id<"calls">, ...patch }).catch(
				() => {},
			);
		},
		[updateMediaMutation],
	);

	const toggleMute = useCallback(() => {
		const next = !useCallStore.getState().isMuted;
		managerRef.current?.setMuted(next);
		useCallStore.getState().setMuted(next);
		syncMedia({ isMuted: next });
	}, [syncMedia]);

	const toggleCamera = useCallback(() => {
		const next = !useCallStore.getState().isCameraOff;
		managerRef.current?.setCameraOff(next);
		useCallStore.getState().setCameraOff(next);
		syncMedia({ isCameraOff: next });
	}, [syncMedia]);

	const toggleScreenShare = useCallback(async () => {
		const manager = managerRef.current;
		if (!manager) return;
		const sharing = useCallStore.getState().isScreenSharing;
		try {
			if (sharing) {
				await manager.stopScreenShare();
				useCallStore.getState().setScreenSharing(false);
				syncMedia({ isScreenSharing: false });
			} else {
				await manager.startScreenShare();
				useCallStore.getState().setScreenSharing(true);
				syncMedia({ isScreenSharing: true });
			}
		} catch {
			// User dismissed the screen picker — no-op.
		}
	}, [syncMedia]);

	const remoteName =
		remotePeer?.user?.displayName ??
		remotePeer?.user?.username ??
		incomingCall?.initiator?.displayName ??
		incomingCall?.initiator?.username ??
		"Inconnu";

	return {
		phase,
		callId,
		callType,
		conversationId,
		direction,
		startedAt,
		isMuted,
		isCameraOff,
		isScreenSharing,
		localStream,
		remoteStream,
		error,
		startCall,
		acceptCall,
		declineCall,
		hangUp,
		toggleMute,
		toggleCamera,
		toggleScreenShare,
		// Peer display info
		remoteName,
		remoteImage:
			remotePeer?.user?.image ?? incomingCall?.initiator?.image ?? null,
		remoteIsMuted: remotePeer?.isMuted ?? false,
		remoteIsCameraOff: remotePeer?.isCameraOff ?? false,
		callerName:
			incomingCall?.initiator?.displayName ??
			incomingCall?.initiator?.username ??
			"Quelqu'un",
		callerImage: incomingCall?.initiator?.image ?? null,
	};
}
