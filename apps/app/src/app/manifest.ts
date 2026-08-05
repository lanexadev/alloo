import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Alloo — Juste discuter. Rien d'autre.",
		short_name: "Alloo",
		description:
			"Chat minimaliste dans ton navigateur. Messages privés et groupes, zéro bloat.",
		start_url: "/chat",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		lang: "fr",
		background_color: "#f7f8fa",
		theme_color: "#f7f8fa",
		icons: [
			{
				src: "/icon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
			{
				src: "/icon-maskable.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "maskable",
			},
		],
	};
}
