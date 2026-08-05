"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatLastSeen } from "@/lib/format-time";
import { AtSign, Clock, Info } from "lucide-react";

interface UserProfileData {
  _id: string;
  username?: string;
  displayName?: string;
  name?: string;
  bio?: string;
  image?: string;
  isOnline: boolean;
  lastSeenAt?: number;
  role?: string;
}

interface UserProfileDialogProps {
  user: UserProfileData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({
  user,
  open,
  onOpenChange,
}: UserProfileDialogProps) {
  if (!user) return null;

  const displayName = user.displayName ?? user.name ?? user.username ?? "Inconnu";
  const status = user.isOnline
    ? "En ligne"
    : formatLastSeen(user.lastSeenAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader className="sr-only">
          <DialogTitle>Profil de {displayName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 pt-2">
          {/* Avatar */}
          <UserAvatar
            src={user.image}
            fallback={displayName}
            isOnline={user.isOnline}
            size="lg"
          />

          {/* Name + role */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{displayName}</h3>
            {user.username && (
              <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <AtSign className="h-3 w-3" />
                {user.username}
              </p>
            )}
            {user.role === "admin" && (
              <Badge variant="secondary" className="mt-1.5">
                Admin
              </Badge>
            )}
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="w-full rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm leading-relaxed text-foreground">
                  {user.bio}
                </p>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{status}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
