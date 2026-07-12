"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquarePlus, Users, Search, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthActions } from "@convex-dev/auth/react";
import { formatMessageTime } from "@/lib/format-time";

interface SidebarProps {
  selectedConversation: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
}

export function Sidebar({
  selectedConversation,
  onSelectConversation,
}: SidebarProps) {
  const conversations = useQuery(api.conversations.list);
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuthActions();
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [filter, setFilter] = useState("");

  const filteredConversations = useMemo(() => {
    if (!conversations) return conversations;
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conv) => {
      const otherMember =
        conv!.type === "dm"
          ? conv!.members.find((m: any) => m && m._id !== user?._id)
          : null;
      const name =
        conv!.type === "dm" && otherMember
          ? ((otherMember as any).displayName ?? otherMember.username ?? conv!.displayName)
          : conv!.displayName;
      return (name ?? "").toLowerCase().includes(q);
    });
  }, [conversations, filter, user?._id]);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="pt-safe">
        <div className="flex h-16 items-center justify-between px-4">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Alloo</h1>
          <div className="flex items-center gap-0.5">
            <NewDMDialog open={showNewDM} onOpenChange={setShowNewDM} onSelectConversation={onSelectConversation} />
            <NewGroupDialog open={showNewGroup} onOpenChange={setShowNewGroup} onSelectConversation={onSelectConversation} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Changer de thème"
              className="h-10 w-10 rounded-full"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher une conversation"
              className="h-10 w-full rounded-full bg-muted pl-10 pr-4 text-base outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2">
          {conversations === undefined && (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {conversations?.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MessageSquarePlus className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Aucune conversation. Commence par envoyer un message !
              </p>
            </div>
          )}
          {conversations && conversations.length > 0 && filteredConversations?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {filter.trim()} »
            </p>
          )}
          {filteredConversations?.map((conv) => {
            const otherMember =
              conv!.type === "dm"
                ? conv!.members.find((m: any) => m && m._id !== user?._id)
                : null;
            const isActive = selectedConversation === conv!._id;
            const hasUnread = (conv!.unreadCount ?? 0) > 0;

            return (
              <button
                key={conv!._id}
                onClick={() => onSelectConversation(conv!._id)}
                className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isActive ? "bg-accent" : "hover:bg-muted active:bg-muted"
                }`}
              >
                <UserAvatar
                  src={otherMember?.image}
                  fallback={conv!.displayName ?? "?"}
                  isOnline={otherMember?.isOnline}
                  isGroup={conv!.type === "group"}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`truncate text-sm ${hasUnread ? "font-semibold" : "font-medium"}`}
                    >
                      {conv!.type === "dm" && otherMember
                        ? (otherMember as any).displayName ?? otherMember.username ?? conv!.displayName
                        : conv!.displayName}
                    </span>
                    {conv!.lastMessage && (
                      <span
                        className={`flex-shrink-0 text-[11px] tabular-nums ${
                          hasUnread ? "font-medium text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {formatMessageTime(conv!.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-xs ${
                        hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {conv!.lastMessage?.content ?? "Nouvelle conversation"}
                    </p>
                    {hasUnread && (
                      <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {conv!.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="border-t border-border pb-safe">
        <div className="flex h-16 items-center gap-3 px-3">
          <UserAvatar
            src={user?.image}
            fallback={user?.displayName ?? user?.username ?? user?.name ?? "?"}
            size="sm"
            isOnline
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.displayName ?? user?.username ?? user?.name ?? "Utilisateur"}
            </p>
            {user?.username && (
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Se déconnecter"
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewDMDialog({
  open,
  onOpenChange,
  onSelectConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (id: Id<"conversations">) => void;
}) {
  const [search, setSearch] = useState("");
  const results = useQuery(api.users.searchUsers, { query: search });
  const createDM = useMutation(api.conversations.createDM);

  const handleSelect = async (userId: Id<"users">) => {
    const conversationId = await createDM({ userId });
    onSelectConversation(conversationId);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Nouveau message"
            className="h-10 w-10 rounded-full"
          />
        }
      >
        <MessageSquarePlus className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {results?.map((u) => (
              <button
                key={u._id}
                onClick={() => handleSelect(u._id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted"
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
            {search.length >= 2 && results?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
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
  onSelectConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (id: Id<"conversations">) => void;
}) {
  const [name, setName] = useState("");
  const createGroup = useMutation(api.conversations.createGroup);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await createGroup({ name: name.trim() });
      onSelectConversation(result.conversationId);
      onOpenChange(false);
      setName("");
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
            className="h-10 w-10 rounded-full"
          />
        }
      >
        <Users className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau groupe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            placeholder="Nom du groupe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Création..." : "Créer le groupe"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
