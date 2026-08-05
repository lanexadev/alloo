"use client";

import { useQuery } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { Button } from "@/components/ui/button";
import { api } from "../../../../../convex/_generated/api";

/**
 * A single conversation, addressed by URL so it can be deep-linked and shared.
 *
 * `conversations.get` takes the raw path segment and normalises it server-side,
 * so a malformed or foreign id resolves to `null` — a "not found" screen rather
 * than a thrown argument-validation error.
 */
export default function ConversationPage() {
	const params = useParams<{ conversationId: string }>();
	const router = useRouter();
	const conversationId = params?.conversationId ?? "";
	const conversation = useQuery(api.conversations.get, { conversationId });

	if (conversation === undefined) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		);
	}

	if (conversation === null) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
				<AlertCircle className="h-10 w-10 text-muted-foreground" />
				<div>
					<p className="font-medium">Conversation introuvable</p>
					<p className="text-sm text-muted-foreground">
						Cette conversation n&apos;existe pas ou tu n&apos;y as plus accès.
					</p>
				</div>
				<Button variant="outline" onClick={() => router.replace("/chat")}>
					Retour aux conversations
				</Button>
			</div>
		);
	}

	return <ChatView conversation={conversation} />;
}
