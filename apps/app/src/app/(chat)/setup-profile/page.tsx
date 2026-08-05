"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { ProfileFields } from "@/components/profile/profile-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
	MAX_USERNAME_LENGTH,
	MIN_USERNAME_LENGTH,
	normalizeUsername,
	validateUsername,
} from "@/lib/profile";
import { api } from "../../../../convex/_generated/api";

export default function SetupProfilePage() {
	const { user, isLoading } = useCurrentUser();
	const updateProfile = useMutation(api.users.updateProfile);
	const avatar = useAvatarUpload();
	const router = useRouter();

	const [username, setUsername] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	// If user already has a username, skip to onboarding or chat
	if (!isLoading && user?.username) {
		if (!user.onboardingCompleted) {
			router.replace("/onboarding");
		} else {
			router.replace("/chat");
		}
		return null;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const invalid = validateUsername(username);
		if (invalid) {
			setError(invalid);
			return;
		}

		setLoading(true);
		try {
			// Upload the photo first if one was picked
			await avatar.commit();

			await updateProfile({
				username,
				displayName: displayName.trim() || undefined,
				bio: bio.trim() || undefined,
			});
			router.replace("/onboarding");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Ce username est déjà pris",
			);
		} finally {
			setLoading(false);
		}
	};

	if (isLoading) {
		return <FullPageSpinner />;
	}

	return (
		<AuthShell
			title="Ton profil"
			subtitle="Voilà comment les autres te verront sur Alloo."
		>
			<div className="flex justify-center">
				<AvatarPicker
					previewUrl={avatar.previewUrl}
					isUploading={avatar.isUploading}
					onSelect={avatar.select}
				/>
			</div>

			<form onSubmit={handleSubmit} className="space-y-5">
				{/* Username (required) */}
				<div>
					<label
						htmlFor="username"
						className="mb-1.5 block text-sm font-medium"
					>
						Username <span className="text-destructive">*</span>
					</label>
					<div className="relative">
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
							@
						</span>
						<Input
							inputSize="lg"
							id="username"
							type="text"
							placeholder="ton_username"
							value={username}
							onChange={(e) => setUsername(normalizeUsername(e.target.value))}
							className="pl-7"
							minLength={MIN_USERNAME_LENGTH}
							maxLength={MAX_USERNAME_LENGTH}
							required
							autoFocus
						/>
					</div>
					<p className="mt-1.5 text-xs text-muted-foreground">
						{MIN_USERNAME_LENGTH}-{MAX_USERNAME_LENGTH} caractères · lettres,
						chiffres, _
					</p>
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

				<Button
					type="submit"
					size="xl"
					className="w-full"
					disabled={loading || avatar.isUploading}
				>
					{loading ? "Un instant…" : "Continuer"}
				</Button>
			</form>
		</AuthShell>
	);
}
