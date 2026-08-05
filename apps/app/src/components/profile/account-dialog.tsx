"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { ProfileFields } from "@/components/profile/profile-fields";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api } from "../../../convex/_generated/api";

interface AccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * "Mon compte" — the only way to edit a profile once onboarding is done.
 * The username is shown but not editable: it is the handle other people
 * search for, so changing it is a separate decision, not a side effect of
 * updating a photo.
 */
export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
	const { user } = useCurrentUser();
	const updateProfile = useMutation(api.users.updateProfile);
	const avatar = useAvatarUpload();

	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reopening the dialog must show what is actually on the account, not the
	// draft the user abandoned last time.
	// biome-ignore lint/correctness/useExhaustiveDependencies: seeding the draft is keyed on the dialog opening — re-running it whenever the user document or the upload helper changes identity would wipe what is being typed
	useEffect(() => {
		if (!open) return;
		setDisplayName(user?.displayName ?? "");
		setBio(user?.bio ?? "");
		setError(null);
		avatar.reset();
	}, [open]);

	const isDirty =
		avatar.hasPendingFile ||
		displayName !== (user?.displayName ?? "") ||
		bio !== (user?.bio ?? "");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user?.username || saving) return;

		setSaving(true);
		setError(null);
		try {
			// Photo first: if it fails, nothing else is written and the dialog
			// stays open with the draft intact.
			await avatar.commit();
			await updateProfile({
				username: user.username,
				displayName: displayName.trim() || undefined,
				bio: bio.trim() || undefined,
			});
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Impossible d'enregistrer. Réessaie.",
			);
		} finally {
			setSaving(false);
		}
	};

	const busy = saving || avatar.isUploading;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-4 p-5">
				<DialogHeader>
					<DialogTitle>Mon compte</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="flex flex-col items-center gap-2">
						<AvatarPicker
							previewUrl={avatar.previewUrl}
							currentImage={user?.image}
							isUploading={avatar.isUploading}
							onSelect={avatar.select}
						/>
						{user?.username && (
							<p className="text-sm text-muted-foreground">@{user.username}</p>
						)}
					</div>

					<ProfileFields
						displayName={displayName}
						onDisplayNameChange={setDisplayName}
						bio={bio}
						onBioChange={setBio}
						displayNamePlaceholder={user?.name ?? undefined}
					/>

					{(avatar.error || error) && (
						<p role="alert" className="text-sm text-destructive">
							{avatar.error ?? error}
						</p>
					)}

					<div className="flex justify-end gap-2 pt-1">
						<Button
							type="button"
							variant="ghost"
							size="xl"
							onClick={() => onOpenChange(false)}
						>
							Annuler
						</Button>
						<Button type="submit" size="xl" disabled={busy || !isDirty}>
							{busy ? "Enregistrement…" : "Enregistrer"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
