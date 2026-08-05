"use client";

import { motion } from "framer-motion";
import { Check, CheckCheck, Languages, Pin } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useMessageTranslation } from "@/hooks/use-message-translation";
import { formatMessageTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { MessageActions } from "./message-actions";
import { MessageReactions, type ReactionGroup } from "./message-reactions";

const LONG_PRESS_MS = 450;

export interface ReplyPreview {
	_id: string;
	content: string;
	senderName: string;
	isOwn: boolean;
}

interface ChatBubbleProps {
	content: string;
	sender: {
		_id: string;
		username?: string;
		displayName?: string;
		name?: string;
		image?: string;
	} | null;
	isOwn: boolean;
	isRead?: boolean;
	timestamp: number;
	showSender: boolean;
	onSenderClick?: () => void;
	isPinned: boolean;
	reactions: ReactionGroup[];
	replyTo: ReplyPreview | null;
	isHighlighted?: boolean;
	onReact: (emoji: string) => void;
	onReply: () => void;
	onTogglePin: () => void;
	onDeleteForMe: () => void;
	onJumpToMessage?: (messageId: string) => void;
}

export const ChatBubble = memo(function ChatBubble({
	content,
	sender,
	isOwn,
	isRead,
	timestamp,
	showSender,
	onSenderClick,
	isPinned,
	reactions = [],
	replyTo,
	isHighlighted,
	onReact,
	onReply,
	onTogglePin,
	onDeleteForMe,
	onJumpToMessage,
}: ChatBubbleProps) {
	const time = formatMessageTime(timestamp);
	const senderDisplayName =
		sender?.displayName ?? sender?.name ?? sender?.username ?? "Inconnu";

	const [menuOpen, setMenuOpen] = useState(false);
	const {
		state: translation,
		translate,
		reset: resetTranslation,
	} = useMessageTranslation(content);

	// Long-press (touch) opens the same actions menu as the 3-dot button
	const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelLongPress = useCallback(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
	}, []);
	const startLongPress = useCallback(
		(e: React.PointerEvent) => {
			if (e.pointerType !== "touch") return;
			cancelLongPress();
			longPressTimer.current = setTimeout(
				() => setMenuOpen(true),
				LONG_PRESS_MS,
			);
		},
		[cancelLongPress],
	);

	const handleCopy = useCallback(() => {
		void navigator.clipboard.writeText(content).catch(() => {});
	}, [content]);

	const myReactions = reactions
		.filter((reaction) => reaction.reactedByMe)
		.map((reaction) => reaction.emoji);

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.15 }}
			className={cn(
				"group/bubble flex gap-2 rounded-xl transition-colors",
				isOwn ? "justify-end" : "justify-start",
				isHighlighted && "bg-primary/10",
			)}
		>
			{/* Avatar for received messages in groups */}
			{showSender && !isOwn && sender && (
				<button
					type="button"
					onClick={onSenderClick}
					className="mt-auto flex-shrink-0 hover:opacity-80 transition-opacity"
				>
					<UserAvatar
						src={sender.image}
						fallback={senderDisplayName}
						size="xs"
					/>
				</button>
			)}

			{/* Actions trigger sits on the text side of own messages */}
			{isOwn && (
				<div className="mt-1 flex items-start self-start">
					<MessageActions
						open={menuOpen}
						onOpenChange={setMenuOpen}
						isOwn={isOwn}
						isPinned={isPinned}
						myReactions={myReactions}
						onReact={onReact}
						onReply={onReply}
						onCopy={handleCopy}
						onTranslate={() => void translate()}
						onTogglePin={onTogglePin}
						onDeleteForMe={onDeleteForMe}
					/>
				</div>
			)}

			<div
				className={cn(
					"max-w-[85%] space-y-0.5 sm:max-w-[70%]",
					isOwn ? "items-end" : "items-start",
				)}
			>
				{showSender && !isOwn && sender && (
					<button
						type="button"
						onClick={onSenderClick}
						className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						{senderDisplayName}
					</button>
				)}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: long-press/right-click open the menu; the accessible path is the labelled 3-dot trigger */}
				<div
					onPointerDown={startLongPress}
					onPointerUp={cancelLongPress}
					onPointerMove={cancelLongPress}
					onPointerCancel={cancelLongPress}
					onContextMenu={(e) => {
						e.preventDefault();
						setMenuOpen(true);
					}}
					className={cn(
						"whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-[15px] leading-relaxed shadow-sm sm:text-sm",
						isOwn
							? "rounded-br-md bg-primary text-primary-foreground"
							: "rounded-bl-md bg-card text-foreground ring-1 ring-border dark:bg-muted dark:ring-0",
					)}
				>
					{replyTo && (
						<button
							type="button"
							onClick={() => onJumpToMessage?.(replyTo._id)}
							className={cn(
								"mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left text-xs",
								isOwn
									? "border-primary-foreground/50 bg-primary-foreground/10"
									: "border-primary bg-muted/60 dark:bg-background/30",
							)}
						>
							<span
								className={cn(
									"block font-medium",
									isOwn ? "text-primary-foreground" : "text-primary",
								)}
							>
								{replyTo.isOwn ? "Toi" : replyTo.senderName}
							</span>
							<span
								className={cn(
									"block truncate",
									isOwn
										? "text-primary-foreground/80"
										: "text-muted-foreground",
								)}
							>
								{replyTo.content}
							</span>
						</button>
					)}
					{content}
					{translation.status !== "idle" && (
						<div
							className={cn(
								"mt-1.5 border-t pt-1.5 text-sm",
								isOwn ? "border-primary-foreground/20" : "border-border",
							)}
						>
							{translation.status === "loading" && (
								<span
									className={cn(
										"text-xs",
										isOwn
											? "text-primary-foreground/70"
											: "text-muted-foreground",
									)}
								>
									Traduction…
								</span>
							)}
							{translation.status === "error" && (
								<span
									className={cn(
										"text-xs",
										isOwn
											? "text-primary-foreground/70"
											: "text-muted-foreground",
									)}
								>
									{translation.message}
								</span>
							)}
							{translation.status === "translated" && (
								<>
									{translation.text}
									<span
										className={cn(
											"mt-0.5 flex items-center gap-1 text-[10px]",
											isOwn
												? "text-primary-foreground/70"
												: "text-muted-foreground",
										)}
									>
										<Languages className="h-3 w-3" /> Traduit ·{" "}
										<button
											type="button"
											onClick={resetTranslation}
											className="underline underline-offset-2"
										>
											Masquer
										</button>
									</span>
								</>
							)}
						</div>
					)}
				</div>
				<MessageReactions
					reactions={reactions}
					isOwn={isOwn}
					onToggle={onReact}
				/>
				<div
					className={cn(
						"flex items-center gap-1 px-1",
						isOwn ? "justify-end" : "justify-start",
					)}
				>
					{isPinned && <Pin className="h-3 w-3 text-primary" />}
					<span className="text-[10px] text-muted-foreground">{time}</span>
					{isOwn &&
						(isRead ? (
							<CheckCheck className="h-3.5 w-3.5 text-blue-500" />
						) : (
							<Check className="h-3.5 w-3.5 text-muted-foreground" />
						))}
				</div>
			</div>

			{!isOwn && (
				<div className="mt-1 flex items-start self-start">
					<MessageActions
						open={menuOpen}
						onOpenChange={setMenuOpen}
						isOwn={isOwn}
						isPinned={isPinned}
						myReactions={myReactions}
						onReact={onReact}
						onReply={onReply}
						onCopy={handleCopy}
						onTranslate={() => void translate()}
						onTogglePin={onTogglePin}
						onDeleteForMe={onDeleteForMe}
					/>
				</div>
			)}
		</motion.div>
	);
});
