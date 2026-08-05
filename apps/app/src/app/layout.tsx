import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { ConvexProvider } from "@/providers/convex-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";

/** One typeface for the whole product. Headings differ by weight and
 *  tracking, never by family. */
const fontSans = Figtree({
	subsets: ["latin"],
	variable: "--font-sans",
});

const fontMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	title: "Alloo — Juste discuter. Rien d'autre.",
	description:
		"Chat minimaliste dans ton navigateur. Messages privés et groupes, zéro bloat. Gratuit.",
	applicationName: "Alloo",
	icons: {
		icon: "/icon.svg",
		apple: "/icon.svg",
	},
	appleWebApp: {
		capable: true,
		title: "Alloo",
		statusBarStyle: "default",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
		{ media: "(prefers-color-scheme: dark)", color: "#1c1d21" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="fr"
			suppressHydrationWarning
			className={cn(
				"antialiased",
				"font-sans",
				fontSans.variable,
				fontMono.variable,
			)}
		>
			<body>
				<ThemeProvider>
					<ConvexProvider>{children}</ConvexProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
