import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/**
 * Shared frame for the signed-out screens: one centred card on the canvas.
 * Every auth page differs only by its title and its form.
 */
export function AuthShell({
	title,
	subtitle,
	children,
	footer,
}: {
	title: string;
	subtitle?: string;
	children: ReactNode;
	footer?: ReactNode;
}) {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
			<div className="w-full max-w-[24rem]">
				<div className="mb-6 text-center">
					<Logo size="md" />
					<h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
					{subtitle && (
						<p className="mt-1.5 text-pretty text-sm text-muted-foreground">
							{subtitle}
						</p>
					)}
				</div>

				<div className="space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6">
					{children}
				</div>

				{footer && (
					<div className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}

/** "ou" rule between the credentials form and the OAuth buttons. */
export function AuthDivider() {
	return (
		<div className="relative">
			<span className="absolute inset-0 flex items-center" aria-hidden>
				<span className="w-full border-t border-border" />
			</span>
			<span className="relative flex justify-center">
				<span className="bg-surface px-3 text-xs text-muted-foreground">
					ou
				</span>
			</span>
		</div>
	);
}
