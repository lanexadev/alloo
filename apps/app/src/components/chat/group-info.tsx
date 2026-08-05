"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
	Check,
	Link as LinkIcon,
	LogOut,
	Pencil,
	QrCode,
	RefreshCw,
	ShieldMinus,
	ShieldPlus,
	UserMinus,
	UserPlus,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatExpiry, formatLastSeen } from "@/lib/format-time";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const COPIED_FEEDBACK_MS = 2000;
const MAX_GROUP_NAME_LENGTH = 100;

type Conversation = NonNullable<
	FunctionReturnType<typeof api.conversations.get>
>;
type MemberData = Conversation["members"][number];

interface GroupInfoProps {
	conversation: Conversation;
	onClose: () => void;
	onMemberClick: (member: MemberData) => void;
}

export function GroupInfo({
	conversation,
	onClose,
	onMemberClick,
}: GroupInfoProps) {
	const router = useRouter();
	const leaveGroup = useMutation(api.conversations.leaveGroup);
	const removeMember = useMutation(api.conversations.removeMember);
	const renameGroup = useMutation(api.conversations.renameGroup);
	const setMemberRole = useMutation(api.conversations.setMemberRole);
	const regenerateInviteCode = useMutation(
		api.conversations.regenerateInviteCode,
	);
	const { user: currentUser } = useCurrentUser();
	const [showQR, setShowQR] = useState(false);
	const [copied, setCopied] = useState(false);
	const [showAddMembers, setShowAddMembers] = useState(false);
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [regenerating, setRegenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isAdmin = conversation.currentUserRole === "admin";
	const members = conversation.members;

	/** Surface backend rejections instead of letting the click silently do nothing. */
	const run = async (action: () => Promise<unknown>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : "L'action a échoué");
		}
	};

	const handleRename = async () => {
		const newName = nameDraft.trim();
		setEditingName(false);
		if (!newName || newName === conversation.name) return;
		await run(() =>
			renameGroup({ conversationId: conversation._id, name: newName }),
		);
	};

	const inviteUrl = conversation.inviteCode
		? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${conversation.inviteCode}`
		: null;
	const inviteExpired =
		conversation.inviteCodeExpiresAt != null &&
		conversation.inviteCodeExpiresAt <= Date.now();

	const handleCopyLink = async () => {
		if (!inviteUrl) return;
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
	};

	const handleRegenerate = async () => {
		setRegenerating(true);
		try {
			await run(() =>
				regenerateInviteCode({ conversationId: conversation._id }),
			);
			setShowQR(false);
		} finally {
			setRegenerating(false);
		}
	};

	const handleLeave = async () => {
		await run(() => leaveGroup({ conversationId: conversation._id }));
		router.replace("/chat");
	};

	return (
		<div className="h-full w-full border-l border-border bg-surface lg:w-80">
			<div className="flex h-14 items-center justify-between border-b border-border pl-4 pr-2">
				<h3 className="text-sm font-semibold">Info du groupe</h3>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Fermer les infos du groupe"
					className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
					onClick={onClose}
				>
					<X className="size-4" />
				</Button>
			</div>

			<ScrollArea className="h-[calc(100%-56px)]">
				<div className="space-y-5 p-4">
					<div className="flex flex-col items-center gap-3 pt-2 text-center">
						<UserAvatar fallback={conversation.name ?? "?"} isGroup size="lg" />
						{editingName ? (
							<form
								className="flex items-center gap-1.5"
								onSubmit={(e) => {
									e.preventDefault();
									void handleRename();
								}}
							>
								<Input
									value={nameDraft}
									onChange={(e) => setNameDraft(e.target.value)}
									maxLength={MAX_GROUP_NAME_LENGTH}
									autoFocus
									className="h-8 text-sm"
								/>
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									aria-label="Enregistrer le nom"
									className="h-8 w-8 flex-shrink-0"
								>
									<Check className="h-4 w-4" />
								</Button>
							</form>
						) : (
							<div className="flex items-center justify-center gap-1.5">
								<h4 className="text-base font-semibold tracking-tight">
									{conversation.name}
								</h4>
								{isAdmin && (
									<Button
										variant="ghost"
										size="icon"
										aria-label="Renommer le groupe"
										className="h-7 w-7 text-muted-foreground"
										onClick={() => {
											setNameDraft(conversation.name ?? "");
											setEditingName(true);
										}}
									>
										<Pencil className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
						)}
						<p className="text-sm text-muted-foreground">
							{members.length} membres
						</p>
					</div>

					{error && (
						<p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{error}
						</p>
					)}

					{/* Invite */}
					{inviteUrl && (
						<div className="space-y-2">
							<h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
								Invitation
							</h5>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									disabled={inviteExpired}
									onClick={handleCopyLink}
								>
									{copied ? (
										"Copié !"
									) : (
										<>
											<LinkIcon className="mr-1.5 h-3 w-3" />
											Copier le lien
										</>
									)}
								</Button>
								<Button
									variant="outline"
									size="icon"
									aria-label="Afficher le QR code"
									disabled={inviteExpired}
									onClick={() => setShowQR(!showQR)}
								>
									<QrCode className="h-3.5 w-3.5" />
								</Button>
								{isAdmin && (
									<Button
										variant="outline"
										size="icon"
										aria-label="Régénérer le lien d'invitation"
										disabled={regenerating}
										onClick={handleRegenerate}
									>
										<RefreshCw className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
							<p className="text-[11px] text-muted-foreground">
								Ce lien {formatExpiry(conversation.inviteCodeExpiresAt)}.
								{isAdmin &&
									" Régénère-le pour invalider les liens déjà partagés."}
							</p>
							{showQR && !inviteExpired && (
								<div className="flex justify-center rounded-lg border border-border bg-white p-4">
									<QRCodeSVG value={inviteUrl} size={160} />
								</div>
							)}
						</div>
					)}

					<Separator />

					{/* Members */}
					<div className="space-y-1">
						<div className="mb-2 flex items-center justify-between">
							<h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
								Membres
							</h5>
							{/* Adding members changes who can read the group, so it takes the
							    same privilege as renaming it or removing someone. */}
							{isAdmin && (
								<Button
									variant="ghost"
									size="sm"
									className="h-7 gap-1.5 px-2 text-xs text-primary"
									onClick={() => setShowAddMembers(true)}
								>
									<UserPlus className="h-3.5 w-3.5" />
									Ajouter
								</Button>
							)}
						</div>
						{members.map((member) => {
							const memberDisplayName =
								member.displayName ??
								member.name ??
								member.username ??
								"Inconnu";

							return (
								<button
									key={member._id}
									type="button"
									onClick={() => onMemberClick(member)}
									className="flex w-full items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-surface-sunken"
								>
									<UserAvatar
										src={member.image}
										fallback={memberDisplayName}
										isOnline={member.isOnline}
										size="sm"
									/>
									<div className="min-w-0 flex-1 text-left">
										<div className="flex items-center gap-1.5">
											<span className="truncate text-sm font-medium">
												{memberDisplayName}
											</span>
											{member.role === "admin" && (
												<span className="text-[10px] font-medium text-primary">
													admin
												</span>
											)}
										</div>
										<p className="text-[11px] text-muted-foreground">
											{member.isOnline
												? "En ligne"
												: formatLastSeen(member.lastSeenAt)}
										</p>
									</div>
									{isAdmin && member._id !== currentUser?._id && (
										<span className="flex flex-shrink-0 items-center">
											{member.role === "member" ? (
												<>
													<Button
														variant="ghost"
														size="icon"
														aria-label={`Nommer ${memberDisplayName} admin`}
														className="h-6 w-6"
														onClick={(e) => {
															e.stopPropagation();
															void run(() =>
																setMemberRole({
																	conversationId: conversation._id,
																	userId: member._id,
																	role: "admin",
																}),
															);
														}}
													>
														<ShieldPlus className="h-3 w-3" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														aria-label={`Retirer ${memberDisplayName}`}
														className="h-6 w-6"
														onClick={(e) => {
															e.stopPropagation();
															void run(() =>
																removeMember({
																	conversationId: conversation._id,
																	userId: member._id,
																}),
															);
														}}
													>
														<UserMinus className="h-3 w-3" />
													</Button>
												</>
											) : (
												<Button
													variant="ghost"
													size="icon"
													aria-label={`Retirer ${memberDisplayName} des admins`}
													className="h-6 w-6"
													onClick={(e) => {
														e.stopPropagation();
														void run(() =>
															setMemberRole({
																conversationId: conversation._id,
																userId: member._id,
																role: "member",
															}),
														);
													}}
												>
													<ShieldMinus className="h-3 w-3" />
												</Button>
											)}
										</span>
									)}
								</button>
							);
						})}
					</div>

					<Separator />

					<Button
						variant="destructive"
						size="lg"
						className="w-full rounded-xl"
						onClick={handleLeave}
					>
						<LogOut className="mr-2 size-3.5" />
						Quitter le groupe
					</Button>
				</div>
			</ScrollArea>

			<AddMembersDialog
				conversationId={conversation._id}
				existingMemberIds={members.map((m) => m._id)}
				open={showAddMembers}
				onOpenChange={setShowAddMembers}
			/>
		</div>
	);
}

function AddMembersDialog({
	conversationId,
	existingMemberIds,
	open,
	onOpenChange,
}: {
	conversationId: Id<"conversations">;
	existingMemberIds: Array<Id<"users">>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const addMembers = useMutation(api.conversations.addMembers);
	const [selected, setSelected] = useState<SelectableUser[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleAdd = async () => {
		if (selected.length === 0) return;
		setLoading(true);
		setError(null);
		try {
			await addMembers({
				conversationId,
				userIds: selected.map((u) => u._id),
			});
			setSelected([]);
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Impossible d'ajouter ces membres",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-5 p-5">
				<DialogHeader>
					<DialogTitle className="text-base">Ajouter des membres</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<UserMultiSelect
						selected={selected}
						onChange={setSelected}
						excludeIds={existingMemberIds}
					/>
					{error && <p className="text-xs text-destructive">{error}</p>}
					<Button
						size="xl"
						className="w-full"
						disabled={loading || selected.length === 0}
						onClick={handleAdd}
					>
						{loading
							? "Ajout..."
							: selected.length > 0
								? `Ajouter ${selected.length} membre${selected.length > 1 ? "s" : ""}`
								: "Ajouter"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
