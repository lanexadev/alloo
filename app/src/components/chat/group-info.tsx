"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Link,
  LogOut,
  Pencil,
  QrCode,
  ShieldMinus,
  ShieldPlus,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatLastSeen } from "@/lib/format-time";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserMultiSelect,
  type SelectableUser,
} from "@/components/chat/user-multi-select";

interface MemberData {
  _id: Id<"users">;
  username?: string;
  displayName?: string;
  name?: string;
  bio?: string;
  image?: string;
  isOnline: boolean;
  lastSeenAt?: number;
  role: string;
}

interface GroupInfoProps {
  conversation: {
    _id: Id<"conversations">;
    name?: string;
    inviteCode?: string;
    members: Array<MemberData | null>;
    currentUserRole: string;
  };
  onClose: () => void;
  onMemberClick: (member: MemberData) => void;
}

export function GroupInfo({ conversation, onClose, onMemberClick }: GroupInfoProps) {
  const leaveGroup = useMutation(api.conversations.leaveGroup);
  const removeMember = useMutation(api.conversations.removeMember);
  const renameGroup = useMutation(api.conversations.renameGroup);
  const setMemberRole = useMutation(api.conversations.setMemberRole);
  const { user: currentUser } = useCurrentUser();
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const isAdmin = conversation.currentUserRole === "admin";

  const handleRename = async () => {
    const newName = nameDraft.trim();
    setEditingName(false);
    if (!newName || newName === conversation.name) return;
    await renameGroup({ conversationId: conversation._id, name: newName });
  };

  const inviteUrl = conversation.inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${conversation.inviteCode}`
    : null;

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    await leaveGroup({ conversationId: conversation._id });
  };

  const handleRemove = async (userId: Id<"users">) => {
    await removeMember({ conversationId: conversation._id, userId });
  };

  const validMembers = conversation.members.filter(Boolean) as MemberData[];

  return (
    <div className="h-full w-full border-l border-border bg-card lg:w-72">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-sm font-semibold">Info du groupe</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-57px)]">
        <div className="space-y-4 p-4">
          <div className="text-center">
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
                  maxLength={100}
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
                <h4 className="text-lg font-semibold">{conversation.name}</h4>
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
              {validMembers.length} membres
            </p>
          </div>

          {/* Invite */}
          {inviteUrl && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium uppercase text-muted-foreground">
                Invitation
              </h5>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    "Copié !"
                  ) : (
                    <>
                      <Link className="mr-1.5 h-3 w-3" />
                      Copier le lien
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QrCode className="h-3.5 w-3.5" />
                </Button>
              </div>
              {showQR && (
                <div className="flex justify-center rounded-lg border bg-white p-4">
                  <QRCodeSVG value={inviteUrl} size={160} />
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Members */}
          <div className="space-y-1">
            <div className="mb-2 flex items-center justify-between">
              <h5 className="text-xs font-medium uppercase text-muted-foreground">
                Membres
              </h5>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-primary"
                onClick={() => setShowAddMembers(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
            {validMembers.map((member) => {
              const memberDisplayName =
                member.displayName ?? member.name ?? member.username ?? "Inconnu";

              return (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => onMemberClick(member)}
                  className="flex w-full items-center gap-2.5 rounded-lg p-2 hover:bg-muted transition-colors"
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
                              void setMemberRole({
                                conversationId: conversation._id,
                                userId: member._id,
                                role: "admin",
                              });
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
                              handleRemove(member._id);
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
                            void setMemberRole({
                              conversationId: conversation._id,
                              userId: member._id,
                              role: "member",
                            });
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
            size="sm"
            className="w-full"
            onClick={handleLeave}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Quitter le groupe
          </Button>
        </div>
      </ScrollArea>

      <AddMembersDialog
        conversationId={conversation._id}
        existingMemberIds={validMembers.map((m) => m._id)}
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

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await addMembers({
        conversationId,
        userIds: selected.map((u) => u._id),
      });
      setSelected([]);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter des membres</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <UserMultiSelect
            selected={selected}
            onChange={setSelected}
            excludeIds={existingMemberIds}
          />
          <Button
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
