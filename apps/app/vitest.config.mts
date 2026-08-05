import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			// Business logic only: the Convex functions and the pure client helpers.
			include: ["convex/**/*.ts", "src/lib/**/*.ts"],
			exclude: [
				"convex/_generated/**",
				"**/*.test.ts",
				"convex/test.setup.ts",
				// Framework wiring, no branches of our own.
				"convex/auth.ts",
				"convex/auth.config.ts",
				"convex/http.ts",
				// "use node" action: needs the Node runtime and live TURN credentials.
				"convex/turn.ts",
				// Browser-only: RTCPeerConnection / AudioContext. Covered by e2e instead.
				"src/lib/webrtc-manager.ts",
				"src/lib/call-sounds.ts",
				"src/lib/utils.ts",
			],
			thresholds: {
				statements: 80,
				branches: 70,
				functions: 85,
				lines: 85,
			},
		},
		projects: [
			{
				// Pure helpers and client-side stores — no I/O, no DOM.
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
				},
			},
			{
				// Convex functions run against convex-test's in-memory backend,
				// which needs the edge runtime (same primitives as production).
				test: {
					name: "convex",
					environment: "edge-runtime",
					include: ["convex/**/*.test.ts"],
					server: { deps: { inline: ["convex-test"] } },
				},
			},
		],
	},
});
