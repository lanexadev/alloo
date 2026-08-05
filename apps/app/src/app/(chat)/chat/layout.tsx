"use client";

import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Two-pane chat shell.
 *
 * The selected conversation lives in the URL (`/chat/<id>`), not in component
 * state, so deep links, browser back/forward and a page refresh all work. This
 * layout keeps the sidebar mounted across navigations; `children` is the right
 * pane (the empty state at `/chat`, a conversation at `/chat/<id>`).
 */
export default function ChatShellLayout({ children }: { children: ReactNode }) {
	const { user, isLoading } = useCurrentUser();
	const router = useRouter();
	const params = useParams<{ conversationId?: string }>();
	const selectedConversation =
		(params?.conversationId as Id<"conversations"> | undefined) ?? null;

	useEffect(() => {
		if (isLoading || !user) return;
		if (!user.username) {
			router.replace("/setup-profile");
			return;
		}
		if (!user.onboardingCompleted) {
			router.replace("/onboarding");
			return;
		}
		// An invite link followed before signing in parks the code here; now that
		// the account is usable, finish the join instead of dropping the invite.
		const pendingInvite = sessionStorage.getItem("pendingInvite");
		if (pendingInvite) {
			sessionStorage.removeItem("pendingInvite");
			router.replace(`/invite/${pendingInvite}`);
		}
	}, [user, isLoading, router]);

	return (
		<div className="flex h-dvh overflow-hidden bg-background">
			{/* On mobile only one pane is visible at a time; both show from md up. */}
			<div
				className={cn(
					"w-full flex-shrink-0 border-border md:block md:w-80 md:border-r lg:w-[360px] xl:w-[400px]",
					selectedConversation ? "hidden" : "block",
				)}
			>
				<Sidebar selectedConversation={selectedConversation} />
			</div>
			<div
				className={cn(
					"min-w-0 flex-1 md:block",
					selectedConversation ? "block" : "hidden",
				)}
			>
				{children}
			</div>
		</div>
	);
}
