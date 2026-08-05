"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import type { CallPhase } from "@/lib/call-store";
import { cn } from "@/lib/utils";
import { CallControls } from "./call-controls";
import { CallTimer } from "./call-timer";
import { VideoGrid } from "./video-grid";

interface CallViewProps {
	phase: CallPhase;
	callType: "audio" | "video";
	remoteName: string;
	remoteImage?: string | null;
	remoteStream: MediaStream | null;
	remoteIsMuted: boolean;
	localStream: MediaStream | null;
	isMuted: boolean;
	isCameraOff: boolean;
	isScreenSharing: boolean;
	startedAt: number | null;
	error: string | null;
	/** Media stopped flowing but ICE is still trying to recover. */
	isReconnecting: boolean;
	onToggleMute: () => void;
	onToggleCamera: () => void;
	onToggleScreenShare: () => void;
	onHangUp: () => void;
}

function AudioWaveAnimation() {
	return (
		<div className="flex items-center justify-center gap-1">
			{[0, 1, 2, 3, 4].map((i) => (
				<motion.div
					key={i}
					className="w-1 rounded-full bg-primary"
					animate={{ height: [8, 24, 8] }}
					transition={{
						duration: 0.8,
						repeat: Number.POSITIVE_INFINITY,
						delay: i * 0.1,
						ease: "easeInOut",
					}}
				/>
			))}
		</div>
	);
}

function getPhaseLabel(phase: CallPhase): string {
	switch (phase) {
		case "calling":
			return "Appel en cours...";
		case "connecting":
			return "Connexion...";
		case "ended":
			return "Appel terminé";
		default:
			return "";
	}
}

export function CallView({
	phase,
	callType,
	remoteName,
	remoteStream,
	remoteIsMuted,
	localStream,
	isMuted,
	isCameraOff,
	isScreenSharing,
	startedAt,
	error,
	isReconnecting,
	onToggleMute,
	onToggleCamera,
	onToggleScreenShare,
	onHangUp,
}: CallViewProps) {
	const isVideoCall = callType === "video";
	// While reconnecting the phase is still "connected", so the status label has
	// to say so explicitly rather than keep counting a timer that means nothing.
	const phaseLabel = isReconnecting ? "Reconnexion…" : getPhaseLabel(phase);
	const showTimer =
		phase === "connected" && startedAt !== null && !isReconnecting;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 flex flex-col bg-gray-900"
		>
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
				className="flex items-center justify-between px-4 py-3"
			>
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
						{isVideoCall ? (
							<Video className="h-3.5 w-3.5 text-white/70" />
						) : (
							<Phone className="h-3.5 w-3.5 text-white/70" />
						)}
						<span className="text-xs font-medium text-white/70">
							{isVideoCall ? "Vidéo" : "Audio"}
						</span>
					</div>
					<span className="text-sm font-semibold text-white">{remoteName}</span>
				</div>

				<div className="text-sm text-white/60">
					{showTimer && startedAt !== null ? (
						<CallTimer
							startedAt={startedAt}
							className="font-mono text-white/70"
						/>
					) : (
						<motion.span
							animate={{ opacity: [0.5, 1, 0.5] }}
							transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
						>
							{phaseLabel}
						</motion.span>
					)}
				</div>
			</motion.div>

			{/* Stage */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{isVideoCall ? (
					<VideoGrid
						remoteStream={remoteStream}
						remoteName={remoteName}
						remoteIsMuted={remoteIsMuted}
						localStream={localStream}
						isCameraOff={isCameraOff}
					/>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-6">
						<motion.div
							animate={
								phase === "connected" ? { scale: [1, 1.03, 1] } : { scale: 1 }
							}
							transition={{
								duration: 3,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
							}}
							className="relative"
						>
							<div
								className={cn(
									"flex h-28 w-28 items-center justify-center rounded-full",
									"bg-gradient-to-br from-primary/20 to-primary/5",
									"ring-2 ring-primary/20",
								)}
							>
								<span className="text-4xl font-bold text-white/80">
									{remoteName[0]?.toUpperCase() ?? "?"}
								</span>
							</div>
							{phase === "connected" && (
								<motion.div
									className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-gray-900 bg-green-500"
									animate={{ scale: [1, 1.2, 1] }}
									transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
								/>
							)}
						</motion.div>

						<div className="text-center">
							<h3 className="text-lg font-semibold text-white">{remoteName}</h3>
							{showTimer ? (
								<div className="mt-3">
									<AudioWaveAnimation />
								</div>
							) : (
								<motion.p
									animate={{ opacity: [0.5, 1, 0.5] }}
									transition={{
										duration: 1.5,
										repeat: Number.POSITIVE_INFINITY,
									}}
									className="mt-1 text-sm text-white/50"
								>
									{phaseLabel}
								</motion.p>
							)}
						</div>
					</div>
				)}

				<AnimatePresence>
					{isReconnecting && !error && (
						<motion.div
							key="reconnecting"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							role="status"
							className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-center text-sm text-amber-200"
						>
							<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
							Connexion instable, reconnexion…
						</motion.div>
					)}
					{error && (
						<motion.div
							key="error"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							role="alert"
							className="mx-4 mb-2 rounded-lg bg-red-500/20 px-4 py-2 text-center text-sm text-red-300"
						>
							{error}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Controls / ended */}
			{phase === "ended" ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="flex items-center justify-center py-8"
				>
					<div className="flex items-center gap-2 text-white/50">
						<PhoneOff className="h-4 w-4" />
						<span className="text-sm">Appel terminé</span>
					</div>
				</motion.div>
			) : (
				<CallControls
					isMuted={isMuted}
					isCameraOff={isCameraOff}
					isScreenSharing={isScreenSharing}
					callType={callType}
					onToggleMute={onToggleMute}
					onToggleCamera={onToggleCamera}
					onToggleScreenShare={onToggleScreenShare}
					onHangUp={onHangUp}
				/>
			)}
		</motion.div>
	);
}
