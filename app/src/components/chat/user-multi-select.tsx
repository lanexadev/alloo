"use client";

import { useQuery } from "convex/react";
import { Check, Search, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export interface SelectableUser {
	_id: Id<"users">;
	username?: string;
	displayName?: string;
	name?: string;
	image?: string;
	isOnline: boolean;
}

interface UserMultiSelectProps {
	selected: SelectableUser[];
	onChange: (users: SelectableUser[]) => void;
	/** Users to hide from search results (e.g. existing group members) */
	excludeIds?: Array<Id<"users">>;
}

function userLabel(user: SelectableUser) {
	return user.displayName ?? user.name ?? user.username ?? "Inconnu";
}

export function UserMultiSelect({
	selected,
	onChange,
	excludeIds,
}: UserMultiSelectProps) {
	const [search, setSearch] = useState("");
	const results = useQuery(api.users.searchUsers, { query: search });

	const excluded = new Set(excludeIds ?? []);
	const selectedIds = new Set(selected.map((u) => u._id));
	const visibleResults = results?.filter((u) => !excluded.has(u._id));

	const toggle = (user: SelectableUser) => {
		if (selectedIds.has(user._id)) {
			onChange(selected.filter((u) => u._id !== user._id));
		} else {
			onChange([...selected, user]);
		}
	};

	return (
		<div className="space-y-3">
			{selected.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{selected.map((user) => (
						<span
							key={user._id}
							className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-xs font-medium text-primary"
						>
							<UserAvatar
								src={user.image}
								fallback={userLabel(user)}
								size="xs"
							/>
							{userLabel(user)}
							<button
								type="button"
								aria-label={`Retirer ${userLabel(user)}`}
								className="rounded-full p-0.5 hover:bg-primary/20"
								onClick={() => toggle(user)}
							>
								<X className="h-3 w-3" />
							</button>
						</span>
					))}
				</div>
			)}

			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Rechercher par username..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-9"
				/>
			</div>

			<div className="max-h-52 space-y-1 overflow-y-auto">
				{visibleResults?.map((u) => {
					const isSelected = selectedIds.has(u._id);
					return (
						<button
							key={u._id}
							type="button"
							onClick={() => toggle(u)}
							className={`flex w-full items-center gap-3 rounded-lg p-2 transition-colors ${
								isSelected ? "bg-primary/5" : "hover:bg-muted"
							}`}
						>
							<UserAvatar
								src={u.image}
								fallback={userLabel(u)}
								isOnline={u.isOnline}
								size="sm"
							/>
							<div className="min-w-0 flex-1 text-left">
								<p className="truncate text-sm font-medium">{userLabel(u)}</p>
								{u.username && (
									<p className="truncate text-xs text-muted-foreground">
										@{u.username}
									</p>
								)}
							</div>
							{isSelected && (
								<Check className="h-4 w-4 flex-shrink-0 text-primary" />
							)}
						</button>
					);
				})}
				{search.length >= 2 && visibleResults?.length === 0 && (
					<p className="py-4 text-center text-sm text-muted-foreground">
						Aucun utilisateur trouvé
					</p>
				)}
			</div>
		</div>
	);
}
