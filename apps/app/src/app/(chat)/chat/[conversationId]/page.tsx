"use client";

import { useQuery } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
				<Spinner size="lg" />
			</div>
		);
	}

	if (conversation === null) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
				<span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-muted-foreground shadow-e1 ring-1 ring-border/60">
					<AlertCircle className="size-7" />
				</span>
				<div>
					<p className="text-base font-semibold tracking-tight">
						Conversation introuvable
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Cette conversation n&apos;existe pas ou tu n&apos;y as plus accès.
					</p>
				</div>
				<Button
					variant="outline"
					size="xl"
					onClick={() => router.replace("/chat")}
				>
					Retour aux conversations
				</Button>
			</div>
		);
	}

	return <ChatView conversation={conversation} />;
}
