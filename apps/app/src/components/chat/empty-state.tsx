"use client";

import { MessageSquare } from "lucide-react";

export function EmptyState() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
			<div className="flex size-12 items-center justify-center rounded-xl bg-surface text-muted-foreground ring-1 ring-border">
				<MessageSquare className="size-5" />
			</div>
			<div className="max-w-xs">
				<h2 className="text-base font-semibold tracking-tight">
					Aucune conversation ouverte
				</h2>
				<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					Sélectionne une conversation à gauche, ou lance-en une nouvelle.
				</p>
			</div>
		</div>
	);
}
