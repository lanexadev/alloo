"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface TypingIndicatorProps {
	conversationId: Id<"conversations">;
}

export function TypingIndicator({ conversationId }: TypingIndicatorProps) {
	const typingUsers = useQuery(api.messages.getTypingUsers, {
		conversationId,
	});

	if (!typingUsers || typingUsers.length === 0) return null;

	const text =
		typingUsers.length === 1
			? `${typingUsers[0]} est en train d'écrire`
			: `${typingUsers.join(", ")} sont en train d'écrire`;

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: "auto" }}
				exit={{ opacity: 0, height: 0 }}
				className="flex items-center gap-2 pt-3"
			>
				<div className="flex items-center gap-1 rounded-bubble rounded-bl-md border border-border bg-bubble-in px-3.5 py-3 dark:border-transparent">
					{[0, 1, 2].map((i) => (
						<motion.span
							key={i}
							className="size-1.5 rounded-full bg-muted-foreground/70"
							animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
							transition={{
								duration: 0.9,
								repeat: Number.POSITIVE_INFINITY,
								delay: i * 0.15,
								ease: "easeInOut",
							}}
						/>
					))}
				</div>
				<span className="text-xs text-muted-foreground">{text}</span>
			</motion.div>
		</AnimatePresence>
	);
}
