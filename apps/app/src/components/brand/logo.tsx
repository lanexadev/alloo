import { cn } from "@/lib/utils";

const sizes = {
	sm: "text-xl",
	md: "text-2xl",
	lg: "text-3xl",
} as const;

/**
 * The wordmark is the brand. No mark, no badge, no gradient — just the name
 * set tight in the product blue.
 */
export function Logo({
	size = "sm",
	className,
}: {
	size?: keyof typeof sizes;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"font-bold tracking-tight text-primary",
				sizes[size],
				className,
			)}
		>
			Alloo
		</span>
	);
}
