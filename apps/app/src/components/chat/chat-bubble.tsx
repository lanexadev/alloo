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
	/** First message of a same-sender block — carries the name. */
	startsBlock: boolean;
	/** Last message of a block — carries the tail, avatar and timestamp. */
	endsBlock: boolean;
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

/** Corner rounding that welds a block of messages into one column. */
function bubbleCorners(
	isOwn: boolean,
	startsBlock: boolean,
	endsBlock: boolean,
): string {
	const tail = isOwn ? "rounded-br-md" : "rounded-bl-md";
	const seam = isOwn ? "rounded-tr-md" : "rounded-tl-md";
	return cn("rounded-bubble", endsBlock && tail, !startsBlock && seam);
}

export const ChatBubble = memo(function ChatBubble({
	content,
	sender,
	isOwn,
	isRead,
	timestamp,
	showSender,
	startsBlock,
	endsBlock,
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

	const actions = (
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
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.16, ease: "easeOut" }}
			className={cn(
				"group/bubble flex gap-2 rounded-lg transition-colors",
				isOwn ? "justify-end" : "justify-start",
				isHighlighted && "bg-primary-subtle",
			)}
		>
			{/* Avatar column for received messages in groups — reserved even when
			    empty so a stacked block stays aligned under its author. */}
			{showSender && !isOwn && (
				<div className="w-9 flex-shrink-0 self-end">
					{endsBlock && sender && (
						<button
							type="button"
							onClick={onSenderClick}
							className="transition-opacity hover:opacity-80"
						>
							<UserAvatar
								src={sender.image}
								fallback={senderDisplayName}
								size="sm"
							/>
						</button>
					)}
				</div>
			)}

			{/* Actions trigger sits on the text side of own messages */}
			{isOwn && actions}

			<div
				className={cn(
					"flex max-w-[85%] flex-col sm:max-w-[62%]",
					isOwn ? "items-end" : "items-start",
				)}
			>
				{showSender && !isOwn && sender && startsBlock && (
					<button
						type="button"
						onClick={onSenderClick}
						className="mb-1 ml-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
						"whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-normal sm:text-sm",
						bubbleCorners(isOwn, startsBlock, endsBlock),
						isOwn
							? "bg-primary text-primary-foreground"
							: "border border-border bg-bubble-in text-foreground dark:border-transparent",
					)}
				>
					{replyTo && (
						<button
							type="button"
							onClick={() => onJumpToMessage?.(replyTo._id)}
							className={cn(
								"mb-1.5 block w-full rounded-md border-l-2 px-2 py-1 text-left text-xs",
								isOwn
									? "border-primary-foreground/50 bg-primary-foreground/12"
									: "border-primary bg-muted/70 dark:bg-background/30",
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
								"mt-2 border-t pt-2 text-sm",
								isOwn ? "border-primary-foreground/25" : "border-border",
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
											"mt-1 flex items-center gap-1 text-[10px]",
											isOwn
												? "text-primary-foreground/70"
												: "text-muted-foreground",
										)}
									>
										<Languages className="size-3" /> Traduit ·{" "}
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

				{/* Only the last message of a block is stamped — a block of six
				    one-word messages should not carry six timestamps. */}
				{(endsBlock || isPinned) && (
					<div
						className={cn(
							"mt-0.5 flex items-center gap-1 px-0.5",
							isOwn ? "justify-end" : "justify-start",
						)}
					>
						{isPinned && <Pin className="size-3 text-muted-foreground" />}
						<span className="text-[11px] tabular-nums text-muted-foreground">
							{time}
						</span>
						{isOwn &&
							endsBlock &&
							(isRead ? (
								<CheckCheck className="size-3.5 text-primary" />
							) : (
								<Check className="size-3.5 text-muted-foreground" />
							))}
					</div>
				)}
			</div>

			{!isOwn && actions}
		</motion.div>
	);
});
