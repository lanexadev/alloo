"use client";

import { useMutation } from "convex/react";
import { Reply, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TEXTAREA_HEIGHT_PX = 140;

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

	return (
		<div className="border-t border-border bg-card/80 pb-safe backdrop-blur-md">
			{error && (
				<div className="mx-auto max-w-3xl px-3 pt-2 sm:px-4">
					<p role="alert" className="text-xs text-destructive">
						{error}
					</p>
				</div>
			)}
			{replyTo && (
				<div className="mx-auto flex max-w-3xl items-center gap-2 px-3 pt-2 sm:px-4">
					<div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-l-2 border-primary bg-muted px-3 py-1.5">
						<Reply className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
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
						className="h-8 w-8 flex-shrink-0 rounded-full"
						onClick={onCancelReply}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			)}
			<div className="mx-auto flex max-w-3xl items-end gap-2 px-3 py-3 sm:px-4">
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
					className="max-h-[140px] min-h-[44px] flex-1 resize-none rounded-3xl bg-muted px-4 py-2.5 text-base leading-relaxed outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm"
				/>
				<Button
					onClick={handleSend}
					disabled={!content.trim() || isSending}
					size="icon"
					aria-label="Envoyer"
					className="h-11 w-11 flex-shrink-0 rounded-full shadow-sm transition-transform active:scale-95"
				>
					<Send className="h-5 w-5" />
				</Button>
			</div>
		</div>
	);
}
