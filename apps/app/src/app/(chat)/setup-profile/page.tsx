"use client";

import { useMutation } from "convex/react";
import { Camera, Loader2, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api } from "../../../../convex/_generated/api";

export default function SetupProfilePage() {
	const { user, isLoading } = useCurrentUser();
	const updateProfile = useMutation(api.users.updateProfile);
	const generateUploadUrl = useMutation(api.users.generateUploadUrl);
	const updateAvatar = useMutation(api.users.updateAvatar);
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [username, setUsername] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);

	// If user already has a username, skip to onboarding or chat
	if (!isLoading && user?.username) {
		if (!user.onboardingCompleted) {
			router.replace("/onboarding");
		} else {
			router.replace("/chat");
		}
		return null;
	}

	const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			setError("Sélectionne une image (JPG, PNG, WebP)");
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			setError("L'image ne doit pas dépasser 5 Mo");
			return;
		}

		setAvatarFile(file);
		const reader = new FileReader();
		reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
		reader.readAsDataURL(file);
		setError("");
	};

	const uploadAvatar = async () => {
		if (!avatarFile) return;
		setUploadingAvatar(true);
		try {
			const uploadUrl = await generateUploadUrl();
			const result = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": avatarFile.type },
				body: avatarFile,
			});
			const { storageId } = await result.json();
			await updateAvatar({ storageId });
		} finally {
			setUploadingAvatar(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (username.length < 3) {
			setError("3 caractères minimum pour le username");
			return;
		}
		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			setError("Lettres, chiffres et underscores uniquement");
			return;
		}

		setLoading(true);
		try {
			// Upload avatar first if selected
			if (avatarFile) await uploadAvatar();

			await updateProfile({
				username,
				displayName: displayName || undefined,
				bio: bio || undefined,
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
			{/* Avatar upload */}
			<div className="flex justify-center">
				<div className="relative">
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						aria-label="Choisir une photo de profil"
						className="group relative flex size-28 items-center justify-center overflow-hidden rounded-full bg-surface-sunken ring-1 ring-border transition-colors hover:bg-accent"
					>
						{avatarPreview ? (
							<Image
								src={avatarPreview}
								alt="Avatar"
								fill
								className="object-cover"
							/>
						) : (
							<User className="size-11 text-muted-foreground" />
						)}
						<span className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/40">
							{uploadingAvatar ? (
								<Loader2 className="size-6 animate-spin text-white" />
							) : (
								<Camera className="size-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
							)}
						</span>
					</button>
					<span className="pointer-events-none absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
						<Camera className="size-4" />
					</span>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						onChange={handleAvatarSelect}
						className="hidden"
					/>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="space-y-5">
				{/* Username (required) */}
				<div>
					<label
						htmlFor="username"
						className="mb-1.5 block text-sm font-semibold"
					>
						Username <span className="text-destructive">*</span>
					</label>
					<div className="relative">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
							@
						</span>
						<Input
							inputSize="lg"
							id="username"
							type="text"
							placeholder="ton_username"
							value={username}
							onChange={(e) =>
								setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))
							}
							className="pl-9"
							minLength={3}
							maxLength={20}
							required
							autoFocus
						/>
					</div>
					<p className="mt-1.5 text-xs text-muted-foreground">
						3-20 caractères · lettres, chiffres, _
					</p>
				</div>

				{/* Display Name (optional) */}
				<div>
					<label
						htmlFor="displayName"
						className="mb-1.5 block text-sm font-semibold"
					>
						Nom d&apos;affichage
					</label>
					<Input
						inputSize="lg"
						id="displayName"
						type="text"
						placeholder={user?.name ?? "Comment tu veux qu'on t'appelle"}
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						maxLength={50}
					/>
				</div>

				{/* Bio (optional) */}
				<div>
					<label htmlFor="bio" className="mb-1.5 block text-sm font-semibold">
						Bio
					</label>
					<textarea
						id="bio"
						placeholder="Dis quelque chose sur toi…"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						maxLength={160}
						rows={3}
						className="w-full resize-none rounded-xl border border-input bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
					/>
					<p className="mt-1 text-right text-xs text-muted-foreground">
						{bio.length}/160
					</p>
				</div>

				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}

				<Button
					type="submit"
					size="xl"
					className="w-full"
					disabled={loading || uploadingAvatar}
				>
					{loading ? "Un instant…" : "Continuer"}
				</Button>
			</form>
		</AuthShell>
	);
}
