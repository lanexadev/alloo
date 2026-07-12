"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  conversationId: Id<"conversations">;
}

export function ChatInput({ conversationId }: ChatInputProps) {
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
      await sendMessage({ conversationId, content: trimmed });
      textareaRef.current?.focus();
    } catch {
      setContent(previousContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = async (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
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

  return (
    <div className="border-t border-border bg-card/80 pb-safe backdrop-blur-md">
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
