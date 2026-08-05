/** Shared profile rules — mirrored server-side in `convex/users.ts`. */

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 20;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 160;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Turns keystrokes into a legal username as they are typed: lowercase, and
 * spaces become underscores rather than being silently dropped.
 */
export function normalizeUsername(input: string): string {
	return input.toLowerCase().replace(/\s/g, "_");
}

/** The reason a username is unacceptable, or null when it passes. */
export function validateUsername(username: string): string | null {
	if (username.length < MIN_USERNAME_LENGTH) {
		return `${MIN_USERNAME_LENGTH} caractères minimum pour le username`;
	}
	if (username.length > MAX_USERNAME_LENGTH) {
		return `${MAX_USERNAME_LENGTH} caractères maximum pour le username`;
	}
	if (!USERNAME_PATTERN.test(username)) {
		return "Lettres, chiffres et underscores uniquement";
	}
	return null;
}

/** The reason a picked avatar cannot be used, or null when it passes. */
export function validateAvatarFile(file: File): string | null {
	if (!file.type.startsWith("image/")) {
		return "Sélectionne une image (JPG, PNG, WebP)";
	}
	if (file.size > MAX_AVATAR_BYTES) {
		return "L'image ne doit pas dépasser 5 Mo";
	}
	return null;
}
