"use client";

import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { validateAvatarFile } from "@/lib/profile";
import { api } from "../../convex/_generated/api";

export interface AvatarUpload {
	/** Data URL of the picked file, or null while none is staged. */
	previewUrl: string | null;
	hasPendingFile: boolean;
	isUploading: boolean;
	/** Why the last pick was refused, or null. */
	error: string | null;
	select: (file: File | undefined | null) => void;
	/** Uploads the staged file and points the account at it. No-op when empty. */
	commit: () => Promise<void>;
	reset: () => void;
}

/**
 * Staging area for a profile photo: the file is validated and previewed on
 * pick, then uploaded only when the surrounding form is submitted — so
 * abandoning a dialog never leaves an orphan image on the account.
 */
export function useAvatarUpload(): AvatarUpload {
	const generateUploadUrl = useMutation(api.users.generateUploadUrl);
	const updateAvatar = useMutation(api.users.updateAvatar);

	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reset = useCallback(() => {
		setFile(null);
		setPreviewUrl(null);
		setError(null);
	}, []);

	const select = useCallback((picked: File | undefined | null) => {
		if (!picked) return;

		const reason = validateAvatarFile(picked);
		if (reason) {
			setError(reason);
			return;
		}

		setError(null);
		setFile(picked);
		const reader = new FileReader();
		reader.onload = (event) => setPreviewUrl(event.target?.result as string);
		reader.readAsDataURL(picked);
	}, []);

	const commit = useCallback(async () => {
		if (!file) return;
		setIsUploading(true);
		try {
			const uploadUrl = await generateUploadUrl();
			const response = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});
			// A failed upload used to be swallowed here: the JSON parse threw a
			// cryptic error and the profile save carried on as if nothing happened.
			if (!response.ok) {
				throw new Error("L'envoi de la photo a échoué. Réessaie.");
			}
			const { storageId } = await response.json();
			await updateAvatar({ storageId });
			setFile(null);
		} finally {
			setIsUploading(false);
		}
	}, [file, generateUploadUrl, updateAvatar]);

	return {
		previewUrl,
		hasPendingFile: file !== null,
		isUploading,
		error,
		select,
		commit,
		reset,
	};
}
