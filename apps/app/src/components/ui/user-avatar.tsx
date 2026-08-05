"use client";

import { Users } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
	src?: string | null;
	fallback: string;
	isOnline?: boolean;
	isGroup?: boolean;
	size?: "xs" | "sm" | "md" | "lg" | "xl";
	className?: string;
}

const sizeMap = {
	xs: "size-6",
	sm: "size-9",
	md: "size-10",
	lg: "size-14",
	xl: "size-20",
};

const textSizeMap = {
	xs: "text-[10px]",
	sm: "text-xs",
	md: "text-sm",
	lg: "text-lg",
	xl: "text-2xl",
};

const dotSizeMap = {
	xs: "size-2 ring-2",
	sm: "size-2.5 ring-2",
	md: "size-2.5 ring-2",
	lg: "size-3.5 ring-[3px]",
	xl: "size-4 ring-4",
};

const iconSizeMap = {
	xs: "size-3",
	sm: "size-4",
	md: "size-[18px]",
	lg: "size-6",
	xl: "size-8",
};

export function UserAvatar({
	src,
	fallback,
	isOnline,
	isGroup,
	size = "md",
	className,
}: UserAvatarProps) {
	const initial = fallback?.[0]?.toUpperCase() ?? "?";

	return (
		<div className={cn("relative flex-shrink-0", className)}>
			<Avatar
				className={cn(sizeMap[size], "relative overflow-hidden rounded-full")}
			>
				{src ? (
					<Image
						src={src}
						alt={fallback}
						fill
						className="rounded-full object-cover"
					/>
				) : (
					<AvatarFallback
						className={cn(
							"font-medium",
							textSizeMap[size],
							isGroup
								? "bg-primary text-primary-foreground"
								: "bg-primary/10 text-primary",
						)}
					>
						{isGroup ? <Users className={iconSizeMap[size]} /> : initial}
					</AvatarFallback>
				)}
			</Avatar>
			{isOnline !== undefined && !isGroup && (
				<span
					className={cn(
						"absolute bottom-0 right-0 rounded-full ring-surface",
						dotSizeMap[size],
						isOnline ? "bg-online" : "bg-muted-foreground/40",
					)}
				/>
			)}
		</div>
	);
}
