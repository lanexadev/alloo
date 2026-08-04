"use client";

import { cn } from "@/lib/utils";

export interface ReactionGroup {
	emoji: string;
	count: number;
	reactedByMe: boolean;
}

interface MessageReactionsProps {
	reactions: ReactionGroup[];
	isOwn: boolean;
	onToggle: (emoji: string) => void;
}

export function MessageReactions({
	reactions,
	isOwn,
	onToggle,
}: MessageReactionsProps) {
	if (reactions.length === 0) return null;

	return (
		<div
			className={cn(
				"-mt-1.5 flex flex-wrap gap-1 px-1",
				isOwn ? "justify-end" : "justify-start",
			)}
		>
			{reactions.map((r) => (
				<button
					key={r.emoji}
					type="button"
					aria-label={`Réaction ${r.emoji} (${r.count})`}
					aria-pressed={r.reactedByMe}
					onClick={() => onToggle(r.emoji)}
					className={cn(
						"flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition-colors",
						r.reactedByMe
							? "border-primary/40 bg-primary/10"
							: "border-border bg-card hover:bg-accent",
					)}
				>
					<span className="text-sm leading-none">{r.emoji}</span>
					{r.count > 1 && (
						<span className="text-[10px] font-medium text-muted-foreground">
							{r.count}
						</span>
					)}
				</button>
			))}
		</div>
	);
}
