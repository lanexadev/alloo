"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertCircle, ArrowLeft, Phone, Users, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCallContext } from "@/components/call/call-provider";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatLastSeen } from "@/lib/format-time";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CallBubble } from "./call-bubble";
import { ChatBubble } from "./chat-bubble";
import { ChatInput, type ReplyTarget } from "./chat-input";
import { GroupInfo } from "./group-info";
import { PinnedBanner } from "./pinned-banner";
import { TypingIndicator } from "./typing-indicator";
import { UserProfileDialog } from "./user-profile-dialog";

interface ChatViewProps {
	conversationId: Id<"conversations">;
	onBack: () => void;
}

export function ChatView({ conversationId, onBack }: ChatViewProps) {
	const messages = useQuery(api.messages.list, { conversationId });
	const conversation = useQuery(api.conversations.get, { conversationId });
	const markAsRead = useMutation(api.conversations.markAsRead);
	const toggleReaction = useMutation(api.messages.toggleReaction);
	const togglePin = useMutation(api.messages.togglePin);
	const deleteForMe = useMutation(api.messages.deleteForMe);
	const { user } = useCurrentUser();
	const { startCall } = useCallContext();
	const scrollRef = useRef<HTMLDivElement>(null);
	const messageRefs = useRef(new Map<string, HTMLDivElement>());
	const [showGroupInfo, setShowGroupInfo] = useState(false);
	const [profileUser, setProfileUser] = useState<any>(null);
	const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
	const [highlightedId, setHighlightedId] = useState<string | null>(null);

	const jumpToMessage = useCallback((messageId: string) => {
		const el = messageRefs.current.get(messageId);
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedId(messageId);
		setTimeout(() => setHighlightedId(null), 1600);
	}, []);

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
			? ((otherDmMember as any).displayName ??
				otherDmMember.username ??
				conversation.displayName)
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
			<div className="border-b border-border bg-card/80 pt-safe backdrop-blur-md">
				<div className="flex h-16 items-center gap-2 px-2 sm:gap-3 sm:px-4">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Retour aux conversations"
						className="h-10 w-10 flex-shrink-0 rounded-full md:hidden"
						onClick={onBack}
					>
						<ArrowLeft className="h-5 w-5" />
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
						className="flex min-w-0 items-center gap-3 rounded-full py-1 pr-3 transition-opacity hover:opacity-80"
					>
						<UserAvatar
							src={
								conversation.type === "dm"
									? (otherDmMember as any)?.image
									: undefined
							}
							fallback={headerDisplayName ?? "?"}
							isOnline={otherDmMember?.isOnline}
							isGroup={conversation.type === "group"}
						/>
						<div className="min-w-0 text-left">
							<h2 className="truncate text-sm font-semibold">
								{headerDisplayName}
							</h2>
							<p className="truncate text-xs text-muted-foreground">
								{otherDmMember?.isOnline ? (
									<span className="text-green-600 dark:text-green-500">
										{statusText}
									</span>
								) : (
									statusText
								)}
							</p>
						</div>
					</button>

					<div className="flex-1" />

					{/* Calls are 1:1 only — hidden for groups */}
					{conversation.type === "dm" && (
						<>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Appel audio"
								className="h-10 w-10 flex-shrink-0 rounded-full"
								onClick={() => void startCall(conversationId, "audio")}
							>
								<Phone className="h-5 w-5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Appel vidéo"
								className="h-10 w-10 flex-shrink-0 rounded-full"
								onClick={() => void startCall(conversationId, "video")}
							>
								<Video className="h-5 w-5" />
							</Button>
						</>
					)}

					{conversation.type === "group" && (
						<Button
							variant="ghost"
							size="icon"
							aria-label="Infos du groupe"
							className="h-10 w-10 flex-shrink-0 rounded-full"
							onClick={() => setShowGroupInfo(!showGroupInfo)}
						>
							<Users className="h-5 w-5" />
						</Button>
					)}
				</div>
			</div>

			<div className="relative flex flex-1 overflow-hidden">
				{/* Messages */}
				<div className="flex min-w-0 flex-1 flex-col">
					<PinnedBanner
						conversationId={conversationId}
						onJumpToMessage={jumpToMessage}
					/>
					<div
						ref={scrollRef}
						className="flex-1 overflow-y-auto px-3 py-4 sm:px-6"
					>
						<div className="mx-auto max-w-3xl space-y-1">
							{messages?.map((msg) =>
								msg.type === "system" ? (
									<div key={msg._id} className="flex justify-center py-1.5">
										<span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">
											{msg.content}
										</span>
									</div>
								) : msg.type === "call" && msg.callData ? (
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
									<div
										key={msg._id}
										ref={(el) => {
											if (el) messageRefs.current.set(msg._id, el);
											else messageRefs.current.delete(msg._id);
										}}
									>
										<ChatBubble
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
											isPinned={msg.pinnedAt != null}
											reactions={msg.reactions}
											replyTo={msg.replyTo}
											isHighlighted={highlightedId === msg._id}
											onReact={(emoji) =>
												void toggleReaction({ messageId: msg._id, emoji })
											}
											onReply={() =>
												setReplyTo({
													messageId: msg._id,
													senderName: msg.isOwn
														? "Toi"
														: (msg.sender?.displayName ??
															msg.sender?.name ??
															msg.sender?.username ??
															"Inconnu"),
													content: msg.content,
												})
											}
											onTogglePin={() => void togglePin({ messageId: msg._id })}
											onDeleteForMe={() =>
												void deleteForMe({ messageId: msg._id })
											}
											onJumpToMessage={jumpToMessage}
										/>
									</div>
								),
							)}
							<TypingIndicator conversationId={conversationId} />
						</div>
					</div>
					<ChatInput
						conversationId={conversationId}
						replyTo={replyTo}
						onCancelReply={() => setReplyTo(null)}
					/>
				</div>

				{/* Group Info Panel — overlay on mobile/tablet, inline on desktop */}
				{showGroupInfo && conversation.type === "group" && (
					<>
						<button
							type="button"
							aria-label="Fermer les infos du groupe"
							className="absolute inset-0 z-30 bg-black/40 lg:hidden"
							onClick={() => setShowGroupInfo(false)}
						/>
						<div className="absolute inset-y-0 right-0 z-40 w-full max-w-xs shadow-xl lg:static lg:z-auto lg:max-w-none lg:w-auto lg:shadow-none">
							<GroupInfo
								conversation={conversation}
								onClose={() => setShowGroupInfo(false)}
								onMemberClick={(member: any) => setProfileUser(member)}
							/>
						</div>
					</>
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
