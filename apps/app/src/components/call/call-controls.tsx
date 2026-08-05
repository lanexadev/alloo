"use client";

import { motion } from "framer-motion";
import {
	Camera,
	CameraOff,
	Mic,
	MicOff,
	Monitor,
	MonitorOff,
	Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CallControlsProps {
	isMuted: boolean;
	isCameraOff: boolean;
	isScreenSharing: boolean;
	callType: "audio" | "video";
	onToggleMute: () => void;
	onToggleCamera: () => void;
	onToggleScreenShare: () => void;
	onHangUp: () => void;
}

interface ControlButtonProps {
	active?: boolean;
	destructive?: boolean;
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}

function ControlButton({
	active,
	destructive,
	label,
	onClick,
	children,
}: ControlButtonProps) {
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.9 }}
			onClick={onClick}
			aria-label={label}
			className={cn(
				"flex items-center justify-center rounded-full transition-colors",
				destructive
					? "h-14 w-14 bg-red-500 text-white hover:bg-red-600"
					: "h-12 w-12",
				!destructive && active
					? "bg-white/20 text-white hover:bg-white/30"
					: !destructive
						? "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
						: undefined,
			)}
		>
			{children}
		</motion.button>
	);
}

export function CallControls({
	isMuted,
	isCameraOff,
	isScreenSharing,
	callType,
	onToggleMute,
	onToggleCamera,
	onToggleScreenShare,
	onHangUp,
}: CallControlsProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2, delay: 0.1 }}
			className="flex items-center justify-center gap-4 px-6 py-6"
		>
			<ControlButton
				active={isMuted}
				label={isMuted ? "Activer le micro" : "Couper le micro"}
				onClick={onToggleMute}
			>
				{isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
			</ControlButton>

			{callType === "video" && (
				<ControlButton
					active={isCameraOff}
					label={isCameraOff ? "Activer la camera" : "Couper la camera"}
					onClick={onToggleCamera}
				>
					{isCameraOff ? (
						<CameraOff className="h-5 w-5" />
					) : (
						<Camera className="h-5 w-5" />
					)}
				</ControlButton>
			)}

			<ControlButton
				active={isScreenSharing}
				label={
					isScreenSharing ? "Arreter le partage d'ecran" : "Partager l'ecran"
				}
				onClick={onToggleScreenShare}
			>
				{isScreenSharing ? (
					<MonitorOff className="h-5 w-5" />
				) : (
					<Monitor className="h-5 w-5" />
				)}
			</ControlButton>

			<ControlButton destructive label="Raccrocher" onClick={onHangUp}>
				<Phone className="h-6 w-6 rotate-[135deg]" />
			</ControlButton>
		</motion.div>
	);
}
