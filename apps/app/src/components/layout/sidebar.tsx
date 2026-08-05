"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
	LogOut,
	MessageSquarePlus,
	Moon,
	Search,
	Sun,
	Users,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { Logo } from "@/components/brand/logo";
import {
	type SelectableUser,
	UserMultiSelect,
} from "@/components/chat/user-multi-select";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatMessageTime } from "@/lib/format-time";
import { formatConversationPreview } from "@/lib/system-message";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const UNREAD_DISPLAY_CAP = "99+";
const MIN_SEARCH_LENGTH = 2;

const FILTERS = [
	{ key: "all", label: "Tous" },
	{ key: "unread", label: "Non lus" },
	{ key: "groups", label: "Groupes" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

interface SidebarProps {
	selectedConversation: Id<"conversations"> | null;
}

export function Sidebar({ selectedConversation }: SidebarProps) {
	const conversations = useQuery(api.conversations.list);
	const { user } = useCurrentUser();
	const { theme, setTheme } = useTheme();
	const { signOut } = useAuthActions();
	const [showNewDM, setShowNewDM] = useState(false);
	const [showNewGroup, setShowNewGroup] = useState(false);
	const [filter, setFilter] = useState("");
	const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

	const unreadTotal = useMemo(
		() => conversations?.filter((conv) => conv.unreadCount > 0).length ?? 0,
		[conversations],
	);

	const filteredConversations = useMemo(() => {
		if (!conversations) return conversations;
		const q = filter.trim().toLowerCase();
		return conversations.filter((conv) => {
			if (activeFilter === "unread" && conv.unreadCount === 0) return false;
			if (activeFilter === "groups" && conv.type !== "group") return false;
			if (!q) return true;
			return (conv.displayName ?? "").toLowerCase().includes(q);
		});
	}, [conversations, filter, activeFilter]);

	const isFiltering = filter.trim().length > 0 || activeFilter !== "all";

	return (
		<div className="flex h-full flex-col bg-surface">
			<div className="pt-safe">
				{/* Header */}
				<div className="flex h-14 items-center justify-between pl-4 pr-2">
					<Logo />
					<div className="flex items-center">
						<NewGroupDialog
							open={showNewGroup}
							onOpenChange={setShowNewGroup}
						/>
						<NewDMDialog open={showNewDM} onOpenChange={setShowNewDM} />
					</div>
				</div>

				{/* Search */}
				<div className="px-3">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="search"
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder="Rechercher"
							className="h-9 w-full rounded-lg bg-surface-sunken pl-8 pr-8 text-base outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30 sm:text-sm"
						/>
						{filter && (
							<button
								type="button"
								aria-label="Effacer la recherche"
								onClick={() => setFilter("")}
								className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<X className="size-3.5" />
							</button>
						)}
					</div>
				</div>

				{/* Segmented filter */}
				<div className="px-3 pb-2 pt-2.5">
					<div className="flex rounded-lg bg-surface-sunken p-0.5">
						{FILTERS.map((option) => {
							const isActive = activeFilter === option.key;
							return (
								<button
									key={option.key}
									type="button"
									aria-pressed={isActive}
									onClick={() => setActiveFilter(option.key)}
									className={cn(
										"flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[0.4rem] text-xs font-medium transition-colors",
										isActive
											? "bg-surface text-foreground shadow-e1"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{option.label}
									{option.key === "unread" && unreadTotal > 0 && (
										<span className="text-[11px] tabular-nums text-primary">
											{unreadTotal}
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Conversation list */}
			<ScrollArea className="flex-1">
				<div className="px-2 pb-2">
					{conversations === undefined && (
						<div className="space-y-0.5">
							{SKELETON_ROWS.map((key) => (
								<div key={key} className="flex h-16 items-center gap-3 px-2">
									<div className="size-10 animate-pulse rounded-full bg-muted" />
									<div className="flex-1 space-y-2">
										<div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
										<div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
									</div>
								</div>
							))}
						</div>
					)}

					{conversations?.length === 0 && (
						<p className="px-6 py-12 text-center text-sm text-muted-foreground">
							Aucune conversation. Commence par envoyer un message.
						</p>
					)}

					{conversations &&
						conversations.length > 0 &&
						filteredConversations?.length === 0 && (
							<p className="px-6 py-12 text-center text-sm text-muted-foreground">
								{isFiltering ? "Aucun résultat." : "Aucune conversation."}
							</p>
						)}

					{filteredConversations?.map((conv) => {
						const isActive = selectedConversation === conv._id;
						const hasUnread = conv.unreadCount > 0;
						const displayName = conv.displayName ?? "Sans nom";

						return (
							<Link
								key={conv._id}
								href={`/chat/${conv._id}`}
								prefetch={false}
								className={cn(
									"flex h-16 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors",
									isActive
										? "bg-primary-subtle"
										: "hover:bg-accent active:bg-accent",
								)}
							>
								<UserAvatar
									src={conv.otherMember?.image}
									fallback={displayName}
									isOnline={conv.otherMember?.isOnline}
									isGroup={conv.type === "group"}
									size="md"
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline justify-between gap-2">
										<span
											className={cn(
												"truncate text-sm",
												hasUnread ? "font-semibold" : "font-medium",
											)}
										>
											{displayName}
										</span>
										{conv.lastMessage && (
											<span
												className={cn(
													"flex-shrink-0 text-[11px] tabular-nums",
													hasUnread ? "text-primary" : "text-muted-foreground",
												)}
											>
												{formatMessageTime(conv.lastMessage.createdAt)}
											</span>
										)}
									</div>
									<div className="mt-0.5 flex items-center justify-between gap-2">
										<p
											className={cn(
												"truncate text-[13px]",
												hasUnread
													? "font-medium text-foreground"
													: "text-muted-foreground",
											)}
										>
											{formatConversationPreview(conv.lastMessage)}
										</p>
										{hasUnread && (
											<span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
												{conv.hasMoreUnread
													? UNREAD_DISPLAY_CAP
													: conv.unreadCount}
											</span>
										)}
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			</ScrollArea>

			{/* Current user */}
			<div className="border-t border-border pb-safe">
				<div className="flex h-16 items-center gap-2.5 pl-3 pr-2">
					<UserAvatar
						src={user?.image}
						fallback={user?.displayName ?? user?.username ?? user?.name ?? "?"}
						size="sm"
						isOnline
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">
							{user?.displayName ??
								user?.username ??
								user?.name ??
								"Utilisateur"}
						</p>
						{user?.username && (
							<p className="truncate text-xs text-muted-foreground">
								@{user.username}
							</p>
						)}
					</div>
					<IconButton
						label="Changer de thème"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
					>
						{theme === "dark" ? (
							<Sun className="size-[18px]" />
						) : (
							<Moon className="size-[18px]" />
						)}
					</IconButton>
					<IconButton
						label="Se déconnecter"
						onClick={() => signOut()}
						className="hover:text-destructive"
					>
						<LogOut className="size-[18px]" />
					</IconButton>
				</div>
			</div>
		</div>
	);
}

/** The one icon-button shape of the app: 36px, ghost, muted until hovered. */
function IconButton({
	label,
	onClick,
	className,
	children,
}: {
	label: string;
	onClick: () => void;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label={label}
			onClick={onClick}
			className={cn(
				"size-9 flex-shrink-0 rounded-lg text-muted-foreground hover:text-foreground",
				className,
			)}
		>
			{children}
		</Button>
	);
}

function NewDMDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const results = useQuery(api.users.searchUsers, { query: search });
	const createDM = useMutation(api.conversations.createDM);

	const handleSelect = async (userId: Id<"users">) => {
		const conversationId = await createDM({ userId });
		onOpenChange(false);
		setSearch("");
		router.push(`/chat/${conversationId}`);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						aria-label="Nouveau message"
						className="size-9 rounded-lg text-primary"
					/>
				}
			>
				<MessageSquarePlus className="size-[18px]" />
			</DialogTrigger>
			<DialogContent className="gap-4 p-4">
				<DialogHeader>
					<DialogTitle>Nouveau message</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							inputSize="lg"
							placeholder="Rechercher par username"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<div className="max-h-72 space-y-0.5 overflow-y-auto">
						{results?.map((u) => (
							<button
								key={u._id}
								type="button"
								onClick={() => void handleSelect(u._id)}
								className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
							>
								<UserAvatar
									src={u.image}
									fallback={u.displayName ?? u.username ?? "?"}
									isOnline={u.isOnline}
									size="sm"
								/>
								<div className="min-w-0 flex-1 text-left">
									<p className="truncate text-sm font-medium">
										{u.displayName ?? u.name ?? u.username}
									</p>
									{u.username && (
										<p className="truncate text-xs text-muted-foreground">
											@{u.username}
										</p>
									)}
								</div>
							</button>
						))}
						{search.trim().length >= MIN_SEARCH_LENGTH &&
							results?.length === 0 && (
								<p className="py-6 text-center text-sm text-muted-foreground">
									Aucun utilisateur trouvé
								</p>
							)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function NewGroupDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [members, setMembers] = useState<SelectableUser[]>([]);
	const createGroup = useMutation(api.conversations.createGroup);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		setLoading(true);
		setError(null);
		try {
			const result = await createGroup({
				name: name.trim(),
				memberIds: members.map((m) => m._id),
			});
			onOpenChange(false);
			setName("");
			setMembers([]);
			router.push(`/chat/${result.conversationId}`);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Impossible de créer le groupe. Réessaie.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						aria-label="Nouveau groupe"
						className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
					/>
				}
			>
				<Users className="size-[18px]" />
			</DialogTrigger>
			<DialogContent className="gap-4 p-4">
				<DialogHeader>
					<DialogTitle>Nouveau groupe</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleCreate} className="space-y-3">
					<Input
						inputSize="lg"
						placeholder="Nom du groupe"
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={100}
						required
					/>
					<div className="space-y-2">
						<p className="text-xs font-medium text-muted-foreground">Membres</p>
						<UserMultiSelect selected={members} onChange={setMembers} />
					</div>
					{error && <p className="text-xs text-destructive">{error}</p>}
					<Button type="submit" size="xl" className="w-full" disabled={loading}>
						{loading
							? "Création…"
							: members.length > 0
								? `Créer le groupe (${members.length + 1} membres)`
								: "Créer le groupe"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
