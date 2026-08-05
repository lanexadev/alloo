"use client";

import { Input } from "@/components/ui/input";
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH } from "@/lib/profile";

interface ProfileFieldsProps {
	displayName: string;
	onDisplayNameChange: (value: string) => void;
	bio: string;
	onBioChange: (value: string) => void;
	displayNamePlaceholder?: string;
}

/**
 * The two optional profile fields, identical during setup and later edits.
 * The username lives outside because it is only editable at setup time.
 */
export function ProfileFields({
	displayName,
	onDisplayNameChange,
	bio,
	onBioChange,
	displayNamePlaceholder,
}: ProfileFieldsProps) {
	return (
		<>
			<div>
				<label
					htmlFor="displayName"
					className="mb-1.5 block text-sm font-medium"
				>
					Nom d&apos;affichage
				</label>
				<Input
					inputSize="lg"
					id="displayName"
					type="text"
					placeholder={
						displayNamePlaceholder ?? "Comment tu veux qu'on t'appelle"
					}
					value={displayName}
					onChange={(e) => onDisplayNameChange(e.target.value)}
					maxLength={MAX_DISPLAY_NAME_LENGTH}
				/>
			</div>

			<div>
				<label htmlFor="bio" className="mb-1.5 block text-sm font-medium">
					Bio
				</label>
				<textarea
					id="bio"
					placeholder="Dis quelque chose sur toi…"
					value={bio}
					onChange={(e) => onBioChange(e.target.value)}
					maxLength={MAX_BIO_LENGTH}
					rows={3}
					className="w-full resize-none rounded-lg border border-input bg-surface px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
				/>
				<p className="mt-1 text-right text-xs text-muted-foreground">
					{bio.length}/{MAX_BIO_LENGTH}
				</p>
			</div>
		</>
	);
}
