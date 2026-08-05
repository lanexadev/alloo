"use client";

import { motion } from "framer-motion";
import { MicOff } from "lucide-react";
import { useEffect, useRef } from "react";

function useStream(stream: MediaStream | null) {
	const ref = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (el) el.srcObject = stream;
		return () => {
			if (el) el.srcObject = null;
		};
	}, [stream]);
	return ref;
}

interface VideoGridProps {
	remoteStream: MediaStream | null;
	remoteName: string;
	remoteIsMuted: boolean;
	localStream: MediaStream | null;
	isCameraOff: boolean;
}

/** 1:1 video stage — the peer fills the frame, the local camera is a PiP. */
export function VideoGrid({
	remoteStream,
	remoteName,
	remoteIsMuted,
	localStream,
	isCameraOff,
}: VideoGridProps) {
	const remoteRef = useStream(remoteStream);
	const localRef = useStream(localStream);
	const hasRemoteVideo =
		remoteStream !== null && remoteStream.getVideoTracks().length > 0;

	return (
		<div className="relative flex-1 p-2">
			<div className="relative h-full w-full overflow-hidden rounded-xl bg-black/40">
				{hasRemoteVideo ? (
					// biome-ignore lint/a11y/useMediaCaption: live WebRTC stream has no caption track
					<video
						ref={remoteRef}
						autoPlay
						playsInline
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center">
						<div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
							<span className="text-3xl font-semibold text-white/60">
								{remoteName[0]?.toUpperCase() ?? "?"}
							</span>
						</div>
					</div>
				)}

				<div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1">
					<span className="text-xs font-medium text-white">{remoteName}</span>
					{remoteIsMuted && <MicOff className="h-3 w-3 text-red-400" />}
				</div>
			</div>

			{/* Local picture-in-picture */}
			{!isCameraOff && (
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.2 }}
					className="absolute bottom-4 right-4 z-10 h-32 w-24 overflow-hidden rounded-xl border-2 border-white/20 shadow-xl sm:h-40 sm:w-30"
				>
					{localStream ? (
						<video
							ref={localRef}
							autoPlay
							playsInline
							muted
							className="h-full w-full scale-x-[-1] object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center bg-black/60">
							<span className="text-xs text-white/60">Toi</span>
						</div>
					)}
				</motion.div>
			)}
		</div>
	);
}
