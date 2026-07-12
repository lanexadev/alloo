"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ChatBubble } from "./chat-bubble";
import { CallBubble } from "./call-bubble";
import { ChatInput } from "./chat-input";
import { TypingIndicator } from "./typing-indicator";
import { GroupInfo } from "./group-info";
import { UserProfileDialog } from "./user-profile-dialog";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, AlertCircle, Phone, Video } from "lucide-react";
import { useCallContext } from "@/components/call/call-provider";
import { formatLastSeen } from "@/lib/format-time";

interface ChatViewProps {
  conversationId: Id<"conversations">;
  onBack: () => void;
}

export function ChatView({ conversationId, onBack }: ChatViewProps) {
  const messages = useQuery(api.messages.list, { conversationId });
  const conversation = useQuery(api.conversations.get, { conversationId });
  const markAsRead = useMutation(api.conversations.markAsRead);
  const { user } = useCurrentUser();
  const { startCall } = useCallContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [profileUser, setProfileUser] = useState<any>(null);

  useEffect(() => {
    if (messages && messages.length > 0) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      void markAsRead({ conversationId }).catch(() => {});
    }
  }, [messages, conversationId, markAsRead]);

  if (conversation === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (conversation === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Conversation introuvable</p>
          <p className="text-sm text-muted-foreground">
            Cette conversation n&apos;existe pas ou tu n&apos;y as plus accès.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
      </div>
    );
  }

  const otherDmMember =
    conversation.type === "dm" && user
      ? conversation.members.find((m: any) => m && m._id !== user._id)
      : null;

  const headerDisplayName =
    conversation.type === "dm" && otherDmMember
      ? (otherDmMember as any).displayName ?? otherDmMember.username ?? conversation.displayName
      : conversation.displayName;

  const statusText =
    conversation.type === "dm" && otherDmMember
      ? otherDmMember.isOnline
        ? "En ligne"
        : formatLastSeen((otherDmMember as any).lastSeenAt)
      : `${conversation.members.length} membres`;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <button
          type="button"
          onClick={() => {
            if (conversation.type === "dm" && otherDmMember) {
              setProfileUser(otherDmMember);
            } else if (conversation.type === "group") {
              setShowGroupInfo(!showGroupInfo);
            }
          }}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <UserAvatar
            src={conversation.type === "dm" ? (otherDmMember as any)?.image : undefined}
            fallback={headerDisplayName ?? "?"}
            isOnline={otherDmMember?.isOnline}
            isGroup={conversation.type === "group"}
          />
          <div className="min-w-0 text-left">
            <h2 className="truncate text-sm font-semibold">
              {headerDisplayName}
            </h2>
            <p className="text-xs text-muted-foreground">{statusText}</p>
          </div>
        </button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void startCall(conversationId, "audio")}
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void startCall(conversationId, "video")}
        >
          <Video className="h-4 w-4" />
        </Button>

        {conversation.type === "group" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGroupInfo(!showGroupInfo)}
          >
            <Users className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              {messages?.map((msg) =>
                msg.type === "call" && msg.callData ? (
                  <CallBubble
                    key={msg._id}
                    callType={msg.callData.callType}
                    status={msg.callData.status}
                    duration={msg.callData.duration}
                    isOwn={msg.isOwn}
                    timestamp={msg._creationTime}
                    senderName={
                      msg.sender?.displayName ??
                      msg.sender?.name ??
                      msg.sender?.username ??
                      "Inconnu"
                    }
                  />
                ) : (
                  <ChatBubble
                    key={msg._id}
                    content={msg.content}
                    sender={msg.sender}
                    isOwn={msg.isOwn}
                    isRead={msg.isRead}
                    timestamp={msg._creationTime}
                    showSender={conversation.type === "group"}
                    onSenderClick={
                      !msg.isOwn && msg.sender
                        ? () => setProfileUser(msg.sender)
                        : undefined
                    }
                  />
                ),
              )}
            </div>
            <TypingIndicator conversationId={conversationId} />
          </div>
          <ChatInput conversationId={conversationId} />
        </div>

        {/* Group Info Panel */}
        {showGroupInfo && conversation.type === "group" && (
          <GroupInfo
            conversation={conversation}
            onClose={() => setShowGroupInfo(false)}
            onMemberClick={(member: any) => setProfileUser(member)}
          />
        )}
      </div>

      {/* User Profile Dialog */}
      <UserProfileDialog
        user={profileUser}
        open={!!profileUser}
        onOpenChange={(open) => {
          if (!open) setProfileUser(null);
        }}
      />
    </div>
  );
}
