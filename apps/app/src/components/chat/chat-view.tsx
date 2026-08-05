"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Phone, Users, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useCallContext } from "@/components/call/call-provider";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDateSeparator, formatLastSeen } from "@/lib/format-time";
import { layoutMessages } from "@/lib/message-groups";
import { formatSystemMessage } from "@/lib/system-message";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import { CallBubble } from "./call-bubble";
import { ChatBubble } from "./chat-bubble";
import { ChatInput, type ReplyTarget } from "./chat-input";
import { GroupInfo } from "./group-info";
import { PinnedBanner } from "./pinned-banner";
import { TypingIndicator } from "./typing-indicator";
import { UserProfileDialog } from "./user-profile-dialog";

/** Messages fetched per page. One page covers more than a tall desktop viewport. */
const MESSAGES_PAGE_SIZE = 40;
/** Distance from the top of the scroller that triggers loading older messages. */
const LOAD_MORE_THRESHOLD_PX = 240;
const HIGHLIGHT_DURATION_MS = 1600;
const UNKNOWN_NAME = "Inconnu";

type Conversation = NonNullable<
	FunctionReturnType<typeof api.conversations.get>
>;
type Message = FunctionReturnType<typeof api.messages.list>["page"][number];
type ProfileUser =
	| Conversation["members"][number]
	| NonNullable<Message["sender"]>;

interface ChatViewProps {
	conversation: Conversation;
}

export function ChatView({ conversation }: ChatViewProps) {
	const conversationId = conversation._id;
	const router = useRouter();
	const { user } = useCurrentUser();
	const { startCall } = useCallContext();

	// Paginated, newest-first on the wire. New messages land in the first page, so
	// the open view stays reactive without ever loading the whole history.
	const { results, status, loadMore } = usePaginatedQuery(
		api.messages.list,
		{ conversationId },
		{ initialNumItems: MESSAGES_PAGE_SIZE },
	);
	const messages = useMemo(() => [...results].reverse(), [results]);

	// Day dividers and same-sender blocks are derived, never stored: the layout
	// of a message depends only on its neighbours.
	const layout = useMemo(
		() =>
			layoutMessages(
				messages.map((msg) => ({
					senderId: msg.type === "system" ? null : msg.senderId,
					timestamp: msg._creationTime,
					isPlain: msg.type !== "system" && msg.type !== "call",
				})),
			),
		[messages],
	);

	const markAsRead = useMutation(api.conversations.markAsRead);
	const toggleReaction = useMutation(api.messages.toggleReaction);
	const togglePin = useMutation(api.messages.togglePin);
	const deleteForMe = useMutation(api.messages.deleteForMe);

	const scrollRef = useRef<HTMLDivElement>(null);
	const messageRefs = useRef(new Map<string, HTMLDivElement>());
	/** Scroll height captured just before older messages are prepended. */
	const heightBeforeLoadMore = useRef<number | null>(null);

	const [showGroupInfo, setShowGroupInfo] = useState(false);
	const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
	const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
	const [highlightedId, setHighlightedId] = useState<string | null>(null);

	const jumpToMessage = useCallback((messageId: string) => {
		const el = messageRefs.current.get(messageId);
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedId(messageId);
		setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS);
	}, []);

	const newestMessageId = messages.at(-1)?._id ?? null;

	// Stick to the bottom for new messages only. Prepending older ones must not
	// yank the reader back down.
	useEffect(() => {
		if (!newestMessageId) return;
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
		void markAsRead({ conversationId }).catch(() => {});
	}, [newestMessageId, conversationId, markAsRead]);

	// Keep the reader anchored on the same message after older ones are prepended.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `messages` is the trigger, not a value read here — the correction must run right after the list grows
	useLayoutEffect(() => {
		const el = scrollRef.current;
		const previousHeight = heightBeforeLoadMore.current;
		if (!el || previousHeight === null) return;
		el.scrollTop += el.scrollHeight - previousHeight;
		heightBeforeLoadMore.current = null;
	}, [messages]);

	const handleScroll = useCallback(() => {
		const el = scrollRef.current;
		if (!el || status !== "CanLoadMore") return;
		if (el.scrollTop > LOAD_MORE_THRESHOLD_PX) return;
		heightBeforeLoadMore.current = el.scrollHeight;
		loadMore(MESSAGES_PAGE_SIZE);
	}, [status, loadMore]);

	const otherDmMember =
		conversation.type === "dm" && user
			? (conversation.members.find((m) => m._id !== user._id) ?? null)
			: null;

	const headerDisplayName = conversation.displayName ?? UNKNOWN_NAME;

	const statusText =
		conversation.type === "dm" && otherDmMember
			? otherDmMember.isOnline
				? "En ligne"
				: formatLastSeen(otherDmMember.lastSeenAt)
			: `${conversation.members.length} membres`;

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="z-20 border-b border-border bg-surface pt-safe">
				<div className="flex h-14 items-center gap-1 px-2 sm:px-3">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Retour aux conversations"
						className="size-9 flex-shrink-0 rounded-lg md:hidden"
						onClick={() => router.push("/chat")}
					>
						<ArrowLeft className="size-5" />
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
						className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent"
					>
						<UserAvatar
							src={otherDmMember?.image}
							fallback={headerDisplayName}
							isOnline={otherDmMember?.isOnline}
							isGroup={conversation.type === "group"}
							size="sm"
						/>
						<div className="min-w-0 text-left">
							<h2 className="truncate text-sm font-semibold leading-tight">
								{headerDisplayName}
							</h2>
							<p className="mt-0.5 truncate text-xs text-muted-foreground">
								{statusText}
							</p>
						</div>
					</button>

					<div className="flex-1" />

					{/* Calls are 1:1 only — hidden for groups */}
					{conversation.type === "dm" && (
						<>
							<HeaderAction
								label="Appel audio"
								onClick={() => void startCall(conversationId, "audio")}
							>
								<Phone className="size-[18px]" />
							</HeaderAction>
							<HeaderAction
								label="Appel vidéo"
								onClick={() => void startCall(conversationId, "video")}
							>
								<Video className="size-[18px]" />
							</HeaderAction>
						</>
					)}

					{conversation.type === "group" && (
						<HeaderAction
							label="Infos du groupe"
							active={showGroupInfo}
							onClick={() => setShowGroupInfo(!showGroupInfo)}
						>
							<Users className="size-[18px]" />
						</HeaderAction>
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
						onScroll={handleScroll}
						className="flex-1 overflow-y-auto px-3 py-4 sm:px-6"
					>
						<div className="mx-auto w-full max-w-[68rem]">
							{status === "LoadingMore" && (
								<div className="flex justify-center py-2">
									<div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
								</div>
							)}
							{status === "Exhausted" && messages.length > 0 && (
								<p className="pb-4 text-center text-[11px] text-muted-foreground">
									Début de la conversation
								</p>
							)}
							{messages.map((msg, index) => {
								const { startsBlock, endsBlock, startsDay } = layout[index];
								const isFirst = index === 0;

								return (
									<div key={msg._id}>
										{startsDay && (
											<DaySeparator timestamp={msg._creationTime} />
										)}
										<div
											className={cn(
												startsBlock && !isFirst && "mt-4",
												!startsBlock && "mt-1",
											)}
										>
											{msg.type === "system" ? (
												<div className="flex justify-center py-1.5">
													<span className="px-3 text-center text-[11px] text-muted-foreground">
														{formatSystemMessage(msg.system, msg.content)}
													</span>
												</div>
											) : msg.type === "call" && msg.callData ? (
												<CallBubble
													callType={msg.callData.callType}
													status={msg.callData.status}
													duration={msg.callData.duration}
													isOwn={msg.isOwn}
													timestamp={msg._creationTime}
													senderName={
														msg.sender?.displayName ??
														msg.sender?.name ??
														msg.sender?.username ??
														UNKNOWN_NAME
													}
												/>
											) : (
												<div
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
														startsBlock={startsBlock}
														endsBlock={endsBlock}
														onSenderClick={
															!msg.isOwn && msg.sender
																? () => setProfileUser(msg.sender)
																: undefined
														}
														isPinned={msg.pinnedAt != null}
														reactions={msg.reactions}
														replyTo={
															msg.replyTo
																? {
																		...msg.replyTo,
																		senderName:
																			msg.replyTo.senderName ?? UNKNOWN_NAME,
																	}
																: null
														}
														isHighlighted={highlightedId === msg._id}
														onReact={(emoji) =>
															void toggleReaction({
																messageId: msg._id,
																emoji,
															})
														}
														onReply={() =>
															setReplyTo({
																messageId: msg._id,
																senderName: msg.isOwn
																	? "Toi"
																	: (msg.sender?.displayName ??
																		msg.sender?.name ??
																		msg.sender?.username ??
																		UNKNOWN_NAME),
																content: msg.content,
															})
														}
														onTogglePin={() =>
															void togglePin({ messageId: msg._id })
														}
														onDeleteForMe={() =>
															void deleteForMe({ messageId: msg._id })
														}
														onJumpToMessage={jumpToMessage}
													/>
												</div>
											)}
										</div>
									</div>
								);
							})}
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
							className="absolute inset-0 z-30 bg-foreground/30 backdrop-blur-sm lg:hidden"
							onClick={() => setShowGroupInfo(false)}
						/>
						<div className="absolute inset-y-0 right-0 z-40 w-full max-w-xs shadow-e3 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:shadow-none">
							<GroupInfo
								conversation={conversation}
								onClose={() => setShowGroupInfo(false)}
								onMemberClick={setProfileUser}
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

function HeaderAction({
	label,
	active,
	onClick,
	children,
}: {
	label: string;
	active?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label={label}
			onClick={onClick}
			className={cn(
				"size-9 flex-shrink-0 rounded-lg transition-colors",
				active
					? "bg-primary-subtle text-primary"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			{children}
		</Button>
	);
}

/** Day divider — a hairline rule with the date sitting in it. */
function DaySeparator({ timestamp }: { timestamp: number }) {
	return (
		<div className="flex items-center gap-3 py-4">
			<span className="h-px flex-1 bg-border" />
			<span className="text-[11px] font-medium text-muted-foreground">
				{formatDateSeparator(timestamp)}
			</span>
			<span className="h-px flex-1 bg-border" />
		</div>
	);
}
