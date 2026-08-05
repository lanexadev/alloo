"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronDown, Pin, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface PinnedBannerProps {
	conversationId: Id<"conversations">;
	onJumpToMessage: (messageId: Id<"messages">) => void;
}

export function PinnedBanner({
	conversationId,
	onJumpToMessage,
}: PinnedBannerProps) {
	const pinned = useQuery(api.messages.listPinned, { conversationId });
	const togglePin = useMutation(api.messages.togglePin);
	const [expanded, setExpanded] = useState(false);

	if (!pinned || pinned.length === 0) return null;

	const latest = pinned[0];
	const visible = expanded ? pinned : [latest];

	return (
		<div className="border-b border-border bg-card/60 backdrop-blur-md">
			{visible.map((msg, i) => (
				<div
					key={msg._id}
					className={cn(
						"flex items-center gap-2 px-3 py-1.5 sm:px-4",
						i > 0 && "border-t border-border/50",
					)}
				>
					<Pin className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
					<button
						type="button"
						onClick={() => onJumpToMessage(msg._id)}
						className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
					>
						<span className="block truncate text-xs">
							<span className="font-medium">{msg.senderName ?? "Inconnu"}</span>
							<span className="text-muted-foreground"> · {msg.content}</span>
						</span>
					</button>
					{/* Unpinning someone else's pin is an admin action; the backend
					    enforces it and `canUnpin` mirrors the rule here. */}
					{expanded && msg.canUnpin && (
						<button
							type="button"
							aria-label="Désépingler ce message"
							onClick={() => void togglePin({ messageId: msg._id })}
							className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
					{i === 0 && pinned.length > 1 && (
						<button
							type="button"
							aria-label={
								expanded
									? "Réduire les messages épinglés"
									: `Voir les ${pinned.length} messages épinglés`
							}
							onClick={() => setExpanded(!expanded)}
							className="flex h-6 flex-shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							{pinned.length}
							<ChevronDown
								className={cn(
									"h-3 w-3 transition-transform",
									expanded && "rotate-180",
								)}
							/>
						</button>
					)}
				</div>
			))}
		</div>
	);
}
