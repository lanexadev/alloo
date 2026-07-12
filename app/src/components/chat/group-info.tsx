"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Link, LogOut, QrCode, UserMinus, X } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatLastSeen } from "@/lib/format-time";

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
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

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
            <h4 className="text-lg font-semibold">{conversation.name}</h4>
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
            <h5 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Membres
            </h5>
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
                  {conversation.currentUserRole === "admin" &&
                    member.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(member._id);
                        }}
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
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
    </div>
  );
}
