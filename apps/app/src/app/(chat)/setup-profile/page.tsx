"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, User, Loader2 } from "lucide-react";
import Image from "next/image";

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
    } catch (err: any) {
      setError(err.message ?? "Ce username est déjà pris");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configure ton profil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comment les autres te verront sur Alloo
          </p>
        </div>

        {/* Avatar upload */}
        <div className="flex justify-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-muted transition-colors hover:bg-muted/80"
            >
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Avatar"
                  fill
                  className="object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white opacity-0 group-hover:opacity-100" />
                ) : (
                  <Camera className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
            </button>
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
            <label className="mb-1.5 block text-sm font-medium">
              Username <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                @
              </span>
              <Input
                type="text"
                placeholder="ton_username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))
                }
                className="pl-8"
                minLength={3}
                maxLength={20}
                required
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              3-20 caractères · lettres, chiffres, _
            </p>
          </div>

          {/* Display Name (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Nom d&apos;affichage
            </label>
            <Input
              type="text"
              placeholder={user?.name ?? "Comment tu veux qu'on t'appelle"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Bio (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bio</label>
            <textarea
              placeholder="Dis quelque chose sur toi..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <p className="mt-0.5 text-right text-xs text-muted-foreground">
              {bio.length}/160
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || uploadingAvatar}
          >
            {loading ? "..." : "Continuer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
