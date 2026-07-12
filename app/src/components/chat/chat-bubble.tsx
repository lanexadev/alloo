"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatMessageTime } from "@/lib/format-time";
import { Check, CheckCheck } from "lucide-react";

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
}

export const ChatBubble = memo(function ChatBubble({
  content,
  sender,
  isOwn,
  isRead,
  timestamp,
  showSender,
  onSenderClick,
}: ChatBubbleProps) {
  const time = formatMessageTime(timestamp);
  const senderDisplayName = sender?.displayName ?? sender?.name ?? sender?.username ?? "Inconnu";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
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

      <div
        className={cn(
          "max-w-[85%] space-y-0.5 sm:max-w-[70%]",
          isOwn ? "items-end" : "items-start"
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
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-[15px] leading-relaxed shadow-sm sm:text-sm",
            isOwn
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-card text-foreground ring-1 ring-border dark:bg-muted dark:ring-0"
          )}
        >
          {content}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 px-1",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && (
            isRead ? (
              <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            )
          )}
        </div>
      </div>
    </motion.div>
  );
});
