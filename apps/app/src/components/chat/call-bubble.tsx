"use client";

import { motion } from "framer-motion";
import { Phone, PhoneMissed, PhoneOff, Video } from "lucide-react";
import { memo } from "react";
import { formatMessageTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";

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

	const failed = status === "missed" || status === "declined";

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
			className="flex justify-center py-1"
		>
			<div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
				<Icon
					className={cn(
						"size-3.5",
						failed ? "text-destructive" : "text-muted-foreground",
					)}
				/>
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span className="font-medium text-foreground">
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
