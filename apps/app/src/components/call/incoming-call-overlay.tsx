"use client";

import { motion } from "framer-motion";
import { Phone, PhoneIncoming, PhoneOff } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";

interface IncomingCallOverlayProps {
	callerName: string;
	callerImage?: string | null;
	callType: "audio" | "video";
	onAccept: () => void;
	onDecline: () => void;
}

export function IncomingCallOverlay({
	callerName,
	callerImage,
	callType,
	onAccept,
	onDecline,
}: IncomingCallOverlayProps) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="bg-[oklch(0.16_0.008_260)] fixed inset-0 z-50 flex flex-col items-center justify-center"
		>
			{/* Animated background rings */}
			<div className="absolute inset-0 flex items-center justify-center overflow-hidden">
				{[0, 1, 2].map((i) => (
					<motion.div
						key={i}
						className="absolute rounded-full border border-white/5"
						initial={{ width: 100, height: 100, opacity: 0 }}
						animate={{
							width: [100, 400],
							height: [100, 400],
							opacity: [0.3, 0],
						}}
						transition={{
							duration: 2.5,
							repeat: Number.POSITIVE_INFINITY,
							delay: i * 0.8,
							ease: "easeOut",
						}}
					/>
				))}
			</div>

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center gap-6">
				{/* Call type indicator */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 ring-1 ring-white/10 backdrop-blur-md"
				>
					<PhoneIncoming className="size-4 text-online" />
					<span className="text-sm font-medium text-white/80">
						{callType === "video"
							? "Appel vidéo entrant"
							: "Appel audio entrant"}
					</span>
				</motion.div>

				{/* Pulsating avatar */}
				<motion.div
					animate={{ scale: [1, 1.05, 1] }}
					transition={{
						duration: 2,
						repeat: Number.POSITIVE_INFINITY,
						ease: "easeInOut",
					}}
				>
					<div className="rounded-full p-1 ring-2 ring-white/25">
						<UserAvatar src={callerImage} fallback={callerName} size="xl" />
					</div>
				</motion.div>

				{/* Caller name */}
				<motion.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className="text-center"
				>
					<h2 className="text-xl font-semibold tracking-tight text-white">
						{callerName}
					</h2>
					<motion.p
						animate={{ opacity: [0.5, 1, 0.5] }}
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}}
						className="mt-1 text-sm text-white/60"
					>
						{callType === "video"
							? "Appel vidéo entrant…"
							: "Appel audio entrant…"}
					</motion.p>
				</motion.div>

				{/* Action buttons */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
					className="mt-8 flex items-center gap-12"
				>
					{/* Decline */}
					<div className="flex flex-col items-center gap-2">
						<motion.button
							type="button"
							whileTap={{ scale: 0.9 }}
							onClick={onDecline}
							className="flex size-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-600"
						>
							<PhoneOff className="size-7" />
						</motion.button>
						<span className="text-xs font-medium text-white/60">Refuser</span>
					</div>

					{/* Accept */}
					<div className="flex flex-col items-center gap-2">
						<motion.button
							type="button"
							whileTap={{ scale: 0.9 }}
							animate={{
								boxShadow: [
									"0 0 0 0 rgba(34, 197, 94, 0.4)",
									"0 0 0 12px rgba(34, 197, 94, 0)",
								],
							}}
							transition={{
								duration: 1.5,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeOut",
							}}
							onClick={onAccept}
							className="flex size-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-colors hover:bg-green-600"
						>
							<Phone className="size-7" />
						</motion.button>
						<span className="text-xs font-medium text-white/60">Accepter</span>
					</div>
				</motion.div>
			</div>
		</motion.div>
	);
}
