import type { NextConfig } from "next";

// Hosts allowed to reach the dev server, comma-separated (e.g. a phone on the LAN).
// Dev only — see ALLOO_DEV_ORIGINS in .env.example.
const devOrigins = (process.env.ALLOO_DEV_ORIGINS ?? "127.0.0.1")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const nextConfig: NextConfig = {
	reactCompiler: true,
	allowedDevOrigins: devOrigins,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.convex.cloud",
			},
		],
	},
};

export default nextConfig;
