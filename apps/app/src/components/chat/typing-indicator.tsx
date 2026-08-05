"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";

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
        className="flex items-center gap-2 px-3 py-1"
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 0.6,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
