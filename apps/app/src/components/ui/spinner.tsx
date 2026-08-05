import { cn } from "@/lib/utils";

const sizeMap = {
	sm: "size-4 border-2",
	md: "size-6 border-2",
	lg: "size-8 border-[3px]",
} as const;

/** The single loading indicator of the app — brand ring, transparent top. */
export function Spinner({
	size = "md",
	className,
}: {
	size?: keyof typeof sizeMap;
	className?: string;
}) {
	return (
		<span
			role="status"
			aria-label="Chargement"
			className={cn(
				"inline-block animate-spin rounded-full border-primary border-t-transparent",
				sizeMap[size],
				className,
			)}
		/>
	);
}

/** Full-height centred spinner with an optional caption. */
export function FullPageSpinner({ label }: { label?: string }) {
	return (
		<div className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas">
			<Spinner size="lg" />
			{label && <p className="text-sm text-muted-foreground">{label}</p>}
		</div>
	);
}
