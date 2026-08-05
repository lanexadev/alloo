import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
	"w-full min-w-0 border border-input bg-input/20 transition-colors outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
	{
		variants: {
			inputSize: {
				default:
					"h-7 rounded-md px-2 py-0.5 text-sm file:h-6 file:text-xs/relaxed md:text-xs/relaxed",
				/* Full-page forms — comfortable target, no iOS zoom on focus. */
				lg: "h-11 rounded-lg bg-surface px-3 text-base file:h-9 file:text-sm sm:text-sm",
			},
		},
		defaultVariants: {
			inputSize: "default",
		},
	},
);

function Input({
	className,
	type,
	inputSize,
	...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(inputVariants({ inputSize, className }))}
			{...props}
		/>
	);
}

export { Input, inputVariants };
