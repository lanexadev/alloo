"use client";

import { motion } from "framer-motion";
import { Phone, PhoneMissed, PhoneOff, Video } from "lucide-react";
import { memo } from "react";
import { formatMessageTime } from "@/lib/format-time";

interface CallBubbleProps {
	callType: "audio" | "video";
	status: "ended" | "missed" | "declined";
	duration?: number;
	isOwn: boolean;
	timestamp: number;
	senderName: string;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}min ${seconds.toString().padStart(2, "0")}s`;
	}
	return `${seconds}s`;
}

export const CallBubble = memo(function CallBubble({
	callType,
	status,
	duration,
	isOwn,
	timestamp,
	senderName,
}: CallBubbleProps) {
	const time = formatMessageTime(timestamp);
	const isVideoCall = callType === "video";

	const Icon =
		status === "missed"
			? PhoneMissed
			: status === "declined"
				? PhoneOff
				: isVideoCall
					? Video
					: Phone;

	const iconColor =
		status === "missed" || status === "declined"
			? "text-red-400"
			: "text-green-400";

	let label: string;
	if (status === "missed") {
		label = isOwn ? "Appel sans réponse" : "Appel manqué";
	} else if (status === "declined") {
		label = "Appel refusé";
	} else {
		label = isVideoCall ? "Appel vidéo" : "Appel audio";
	}

	const detail =
		status === "ended" && duration
			? formatDuration(duration)
			: status === "missed"
				? "Aucune réponse"
				: status === "declined"
					? "Refusé"
					: undefined;

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.15 }}
			className="flex justify-center"
		>
			<div className="flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2">
				<Icon className={`h-4 w-4 ${iconColor}`} />
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span className="font-medium text-foreground/80">
						{isOwn ? label : `${senderName} — ${label.toLowerCase()}`}
					</span>
					{detail && (
						<>
							<span>·</span>
							<span>{detail}</span>
						</>
					)}
					<span>·</span>
					<span>{time}</span>
				</div>
			</div>
		</motion.div>
	);
});
