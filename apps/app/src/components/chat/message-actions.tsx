"use client";

import { EmojiPicker } from "frimousse";
import {
	Copy,
	Languages,
	MoreHorizontal,
	Pin,
	PinOff,
	Plus,
	Reply,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageActionsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isOwn: boolean;
	isPinned: boolean;
	myReactions: string[];
	onReact: (emoji: string) => void;
	onReply: () => void;
	onCopy: () => void;
	onTranslate: () => void;
	onTogglePin: () => void;
	onDeleteForMe: () => void;
}

export function MessageActions({
	open,
	onOpenChange,
	isOwn,
	isPinned,
	myReactions,
	onReact,
	onReply,
	onCopy,
	onTranslate,
	onTogglePin,
	onDeleteForMe,
}: MessageActionsProps) {
	const [showPicker, setShowPicker] = useState(false);

	useEffect(() => {
		if (!open) setShowPicker(false);
	}, [open]);

	const react = (emoji: string) => {
		onReact(emoji);
		onOpenChange(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				aria-label="Actions du message"
				className={cn(
					"flex size-7 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
					"opacity-0 focus-visible:opacity-100 group-hover/bubble:opacity-100 data-popup-open:opacity-100",
				)}
			>
				<MoreHorizontal className="h-4 w-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={isOwn ? "end" : "start"}
				className="w-auto min-w-52"
			>
				{showPicker ? (
					// biome-ignore lint/a11y/noStaticElementInteractions: only stops keystroke propagation so the menu typeahead doesn't steal input from the picker search
					<div
						className="h-72 w-64"
						// Keep frimousse's search input keystrokes away from the menu typeahead
						onKeyDown={(e) => e.stopPropagation()}
					>
						<EmojiPicker.Root
							locale="fr"
							columns={8}
							onEmojiSelect={({ emoji }) => react(emoji)}
							className="flex h-full w-full flex-col"
						>
							<EmojiPicker.Search
								autoFocus
								placeholder="Rechercher un emoji…"
								className="mx-1 mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
							/>
							<EmojiPicker.Viewport className="relative flex-1 outline-none">
								<EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
									Chargement…
								</EmojiPicker.Loading>
								<EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
									Aucun emoji trouvé
								</EmojiPicker.Empty>
								<EmojiPicker.List
									className="select-none pb-1"
									components={{
										CategoryHeader: ({ category, ...props }) => (
											<div
												className="bg-popover px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground"
												{...props}
											>
												{category.label}
											</div>
										),
										Row: ({ children, ...props }) => (
											<div className="scroll-my-1 px-1" {...props}>
												{children}
											</div>
										),
										Emoji: ({ emoji, ...props }) => (
											<button
												type="button"
												className="flex size-7 items-center justify-center rounded-md text-base data-[active]:bg-accent"
												{...props}
											>
												{emoji.emoji}
											</button>
										),
									}}
								/>
							</EmojiPicker.Viewport>
						</EmojiPicker.Root>
					</div>
				) : (
					<>
						<div className="flex items-center gap-0.5 px-1 py-1">
							{QUICK_REACTIONS.map((emoji) => (
								<button
									key={emoji}
									type="button"
									aria-label={`Réagir avec ${emoji}`}
									aria-pressed={myReactions.includes(emoji)}
									onClick={() => react(emoji)}
									className={cn(
										"flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent",
										myReactions.includes(emoji) &&
											"bg-primary-subtle ring-1 ring-primary/40",
									)}
								>
									{emoji}
								</button>
							))}
							<button
								type="button"
								aria-label="Plus d'emojis"
								onClick={() => setShowPicker(true)}
								className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onReply}>
							<Reply /> Répondre
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onCopy}>
							<Copy /> Copier
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onTranslate}>
							<Languages /> Traduire
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onTogglePin}>
							{isPinned ? (
								<>
									<PinOff /> Désépingler
								</>
							) : (
								<>
									<Pin /> Épingler
								</>
							)}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onClick={onDeleteForMe}>
							<Trash2 /> Supprimer pour moi
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
