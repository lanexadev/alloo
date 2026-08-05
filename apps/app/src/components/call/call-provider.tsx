"use client";

import { AnimatePresence } from "framer-motion";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useCall } from "@/hooks/use-call";
import {
	playConnectedSound,
	playEndSound,
	playRingbackTone,
	playRingtone,
	type SoundHandle,
} from "@/lib/call-sounds";
import {
	type CallDirection,
	type CallPhase,
	type CallType,
	useCallStore,
} from "@/lib/call-store";
import { CallView } from "./call-view";
import { IncomingCallOverlay } from "./incoming-call-overlay";

const ENDED_SCREEN_MS = 2000;

interface CallContextValue {
	phase: CallPhase;
	callType: CallType | null;
	direction: CallDirection | null;
	startCall: (conversationId: string, type: CallType) => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext(): CallContextValue {
	const ctx = useContext(CallContext);
	if (!ctx)
		throw new Error("useCallContext must be used within a CallProvider");
	return ctx;
}

export function CallProvider({ children }: { children: ReactNode }) {
	const call = useCall();
	const [showEndedScreen, setShowEndedScreen] = useState(false);

	// Brief "ended" screen, then reset to idle so new calls can arrive.
	useEffect(() => {
		if (call.phase !== "ended") {
			setShowEndedScreen(false);
			return;
		}
		setShowEndedScreen(true);
		const t = setTimeout(() => {
			setShowEndedScreen(false);
			useCallStore.getState().reset();
		}, ENDED_SCREEN_MS);
		return () => clearTimeout(t);
	}, [call.phase]);

	// --- sound effects ---------------------------------------------------------
	const ringtoneRef = useRef<SoundHandle | null>(null);
	const ringbackRef = useRef<SoundHandle | null>(null);
	const prevPhaseRef = useRef<CallPhase>(call.phase);

	useEffect(() => {
		if (call.phase === "ringing" && call.direction === "incoming") {
			ringtoneRef.current = playRingtone();
		}
		return () => {
			ringtoneRef.current?.stop();
			ringtoneRef.current = null;
		};
	}, [call.phase, call.direction]);

	useEffect(() => {
		if (call.phase === "calling" && call.direction === "outgoing") {
			ringbackRef.current = playRingbackTone();
		}
		return () => {
			ringbackRef.current?.stop();
			ringbackRef.current = null;
		};
	}, [call.phase, call.direction]);

	useEffect(() => {
		const prev = prevPhaseRef.current;
		prevPhaseRef.current = call.phase;
		if (call.phase === "connected" && prev !== "connected")
			playConnectedSound();
		if (call.phase === "ended" && prev !== "ended" && prev !== "idle")
			playEndSound();
	}, [call.phase]);

	const contextValue: CallContextValue = {
		phase: call.phase,
		callType: call.callType,
		direction: call.direction,
		startCall: call.startCall,
	};

	const isIncoming = call.phase === "ringing" && call.direction === "incoming";
	const showCallView =
		!isIncoming &&
		(call.phase === "calling" ||
			call.phase === "connecting" ||
			call.phase === "connected" ||
			(call.phase === "ended" && showEndedScreen));

	return (
		<CallContext.Provider value={contextValue}>
			{children}

			{/* Remote audio playback (hidden). */}
			{call.remoteStream && <RemoteAudio stream={call.remoteStream} />}

			<AnimatePresence>
				{isIncoming && (
					<IncomingCallOverlay
						key="incoming-call"
						callerName={call.callerName}
						callerImage={call.callerImage}
						callType={call.callType ?? "audio"}
						onAccept={() => void call.acceptCall()}
						onDecline={() => void call.declineCall()}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showCallView && call.callType && (
					<CallView
						key="call-view"
						phase={call.phase}
						callType={call.callType}
						remoteName={call.remoteName}
						remoteImage={call.remoteImage}
						remoteStream={call.remoteStream}
						remoteIsMuted={call.remoteIsMuted}
						localStream={call.localStream}
						isMuted={call.isMuted}
						isCameraOff={call.isCameraOff}
						isScreenSharing={call.isScreenSharing}
						startedAt={call.startedAt}
						error={call.error}
						onToggleMute={call.toggleMute}
						onToggleCamera={call.toggleCamera}
						onToggleScreenShare={() => void call.toggleScreenShare()}
						onHangUp={() => void call.hangUp()}
					/>
				)}
			</AnimatePresence>
		</CallContext.Provider>
	);
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
	const ref = useRef<HTMLAudioElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.srcObject = stream;
		return () => {
			el.srcObject = null;
		};
	}, [stream]);
	// biome-ignore lint/a11y/useMediaCaption: hidden remote audio sink, no caption track
	return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
}
