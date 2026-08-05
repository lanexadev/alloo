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
		<div className="relative flex-1 p-3">
			<div className="relative h-full w-full overflow-hidden rounded-3xl bg-black/40 ring-1 ring-white/10">
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
						<div className="flex size-24 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-md">
							<span className="text-3xl font-semibold text-white/70">
								{remoteName[0]?.toUpperCase() ?? "?"}
							</span>
						</div>
					</div>
				)}

				<div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md">
					<span className="text-xs font-semibold text-white">{remoteName}</span>
					{remoteIsMuted && <MicOff className="size-3 text-red-400" />}
				</div>
			</div>

			{/* Local picture-in-picture */}
			{!isCameraOff && (
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.2 }}
					className="absolute bottom-6 right-6 z-10 h-32 w-24 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/25 sm:h-40 sm:w-30"
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
