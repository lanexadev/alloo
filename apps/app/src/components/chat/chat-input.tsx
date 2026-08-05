"use client";

import { useMutation } from "convex/react";
import { Reply, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
	const sendMessage = useMutation(api.messages.send);
	const setTyping = useMutation(api.messages.setTyping);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleTyping = useCallback(() => {
		void setTyping({ conversationId });
	}, [conversationId, setTyping]);

	const handleSend = async () => {
		const trimmed = content.trim();
		if (!trimmed || isSending) return;

		setIsSending(true);
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
		} catch {
			setContent(previousContent);
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
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: focus when a reply is initiated
	useEffect(() => {
		if (replyTo) textareaRef.current?.focus();
	}, [replyTo]);

	return (
		<div className="border-t border-border bg-card/80 pb-safe backdrop-blur-md">
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
						handleTyping();
						autoGrow();
					}}
					onKeyDown={handleKeyDown}
					placeholder="Écris un message…"
					aria-label="Message"
					rows={1}
					maxLength={4000}
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
