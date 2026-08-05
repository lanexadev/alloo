import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const figtree = Figtree({
	subsets: ["latin"],
	variable: "--font-figtree",
});

export const metadata: Metadata = {
	title: "Alloo — Juste discuter. Rien d'autre.",
	description:
		"Chat minimaliste dans ton navigateur. Messages privés et groupes, zéro bloat. Gratuit.",
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

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="fr" className={`${figtree.variable} font-sans`}>
			<body>{children}</body>
		</html>
	);
}
