"use client";

import { Camera, Loader2, User } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
	/** Data URL of a freshly picked file — wins over `currentImage`. */
	previewUrl: string | null;
	/** The photo already on the account, if any. */
	currentImage?: string | null;
	isUploading: boolean;
	onSelect: (file: File | undefined) => void;
	className?: string;
}

/** Round photo control shared by profile setup and the account dialog. */
export function AvatarPicker({
	previewUrl,
	currentImage,
	isUploading,
	onSelect,
	className,
}: AvatarPickerProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const shown = previewUrl ?? currentImage ?? null;

	return (
		<div className={cn("relative", className)}>
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				aria-label="Changer la photo de profil"
				className="group relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-surface-sunken ring-1 ring-border transition-colors hover:bg-accent"
			>
				{shown ? (
					<Image src={shown} alt="" fill className="object-cover" />
				) : (
					<User className="size-9 text-muted-foreground" />
				)}
				<span className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/40">
					{isUploading ? (
						<Loader2 className="size-5 animate-spin text-white" />
					) : (
						<Camera className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
					)}
				</span>
			</button>
			<span className="pointer-events-none absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
				<Camera className="size-3.5" />
			</span>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				onChange={(e) => {
					onSelect(e.target.files?.[0]);
					// Let the same file be picked again after a failed validation.
					e.target.value = "";
				}}
				className="hidden"
			/>
		</div>
	);
}
