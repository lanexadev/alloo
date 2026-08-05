"use client";

import { useMutation } from "convex/react";
import { Reply, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TEXTAREA_HEIGHT_PX = 140;
/** Below this many characters left, the counter appears. */
const COUNTER_THRESHOLD = 200;

/**
 * Minimum gap between typing pings. The indicator lives for 3s server-side, so
 * one ping per second keeps it alive while turning a burst of keystrokes into a
 * single mutation instead of one per character.
 */
const TYPING_PING_INTERVAL_MS = 1000;

export interface ReplyTarget {
	messageId: Id<"messages">;
	senderName: string;
	content: string;
}

interface ChatInputProps {
	conversationId: Id<"conversations">;
	replyTo?: ReplyTarget | null;
	onCancelReply?: () => void;
}

export function ChatInput({
	conversationId,
	replyTo,
	onCancelReply,
}: ChatInputProps) {
	const [content, setContent] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sendMessage = useMutation(api.messages.send);
	const setTyping = useMutation(api.messages.setTyping);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lastTypingPingAt = useRef(0);

	const handleTyping = useCallback(() => {
		const now = Date.now();
		if (now - lastTypingPingAt.current < TYPING_PING_INTERVAL_MS) return;
		lastTypingPingAt.current = now;
		void setTyping({ conversationId }).catch(() => {
			// Typing indicators are cosmetic; a dropped ping needs no user feedback.
		});
	}, [conversationId, setTyping]);

	const handleSend = async () => {
		const trimmed = content.trim();
		if (!trimmed || isSending) return;

		setIsSending(true);
		setError(null);
		const previousContent = content;
		setContent("");
		if (textareaRef.current) textareaRef.current.style.height = "auto";

		try {
			await sendMessage({
				conversationId,
				content: trimmed,
				replyToId: replyTo?.messageId,
			});
			onCancelReply?.();
			textareaRef.current?.focus();
		} catch (err) {
			// Restore the draft and say why it did not go out — a send can now be
			// refused by the rate limiter, and silently swallowing that looks broken.
			setContent(previousContent);
			setError(
				err instanceof Error && err.message.includes("Rate limit")
					? "Tu envoies trop vite. Patiente un instant."
					: "Le message n'a pas pu être envoyé. Réessaie.",
			);
		} finally {
			setIsSending(false);
		}
	};

	const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			await handleSend();
		}
	};

	const autoGrow = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
	}, []);

	useEffect(() => {
		if (replyTo) textareaRef.current?.focus();
	}, [replyTo]);

	const canSend = content.trim().length > 0 && !isSending;
	const charactersLeft = MAX_MESSAGE_LENGTH - content.length;

	return (
		<div className="border-t border-border bg-surface pb-safe">
			<div className="mx-auto w-full max-w-[68rem] px-3 py-3 sm:px-6">
				{error && (
					<p role="alert" className="mb-2 px-1 text-xs text-destructive">
						{error}
					</p>
				)}

				{replyTo && (
					<div className="mb-2 flex items-center gap-2">
						<div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border-l-2 border-primary bg-surface-sunken px-3 py-2">
							<Reply className="size-3.5 flex-shrink-0 text-primary" />
							<div className="min-w-0 flex-1">
								<p className="text-xs font-medium text-primary">
									{replyTo.senderName}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{replyTo.content}
								</p>
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Annuler la réponse"
							className="size-8 flex-shrink-0 rounded-lg"
							onClick={onCancelReply}
						>
							<X className="size-4" />
						</Button>
					</div>
				)}

				<div className="flex items-end gap-2 rounded-xl border border-input bg-surface-sunken p-1 transition-colors focus-within:border-ring focus-within:bg-surface">
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => {
							setContent(e.target.value);
							if (error) setError(null);
							handleTyping();
							autoGrow();
						}}
						onKeyDown={handleKeyDown}
						placeholder="Écris un message…"
						aria-label="Message"
						rows={1}
						maxLength={MAX_MESSAGE_LENGTH}
						className="max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-2 text-base leading-normal outline-none placeholder:text-muted-foreground sm:text-sm"
					/>
					{charactersLeft <= COUNTER_THRESHOLD && (
						<span className="mb-2.5 text-[11px] tabular-nums text-muted-foreground">
							{charactersLeft}
						</span>
					)}
					{/* Filled only once there is something to send — the composer says
					    "ready" without any decoration. */}
					<Button
						variant={canSend ? "default" : "ghost"}
						size="icon"
						onClick={handleSend}
						disabled={!canSend}
						aria-label="Envoyer"
						className="size-9 flex-shrink-0 rounded-lg disabled:text-muted-foreground disabled:opacity-100"
					>
						<SendHorizontal className="size-[18px]" />
					</Button>
				</div>
			</div>
		</div>
	);
}
