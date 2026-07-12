"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatView } from "@/components/chat/chat-view";
import { EmptyState } from "@/components/chat/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function ChatPage() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();
  const [selectedConversation, setSelectedConversation] =
    useState<Id<"conversations"> | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    if (!user.username) {
      router.replace("/setup-profile");
    } else if (!user.onboardingCompleted) {
      router.replace("/onboarding");
    }
  }, [user, isLoading, router]);

  const handleSelectConversation = useCallback(
    (id: Id<"conversations">) => {
      setSelectedConversation(id);
      setMobileShowChat(true);
    },
    []
  );

  const handleBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div
        className={`w-full flex-shrink-0 border-border md:block md:w-80 md:border-r lg:w-[360px] xl:w-[400px] ${
          mobileShowChat ? "hidden" : "block"
        }`}
      >
        <Sidebar
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
        />
      </div>
      <div
        className={`min-w-0 flex-1 ${mobileShowChat ? "block" : "hidden"} md:block`}
      >
        {selectedConversation ? (
          <ChatView
            conversationId={selectedConversation}
            onBack={handleBack}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
