"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { CallProvider } from "@/components/call/call-provider";
import { FullPageSpinner } from "@/components/ui/spinner";
import { api } from "../../../convex/_generated/api";

export default function ChatLayout({ children }: { children: ReactNode }) {
	const { isAuthenticated, isLoading } = useConvexAuth();
	const router = useRouter();
	const setOnlineStatus = useMutation(api.users.setOnlineStatus);

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.replace("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (!isAuthenticated) return;

		// Initial ping
		setOnlineStatus({ isOnline: true });

		// Heartbeat every 30s to keep lastSeenAt fresh
		const heartbeat = setInterval(() => {
			if (!document.hidden) {
				setOnlineStatus({ isOnline: true });
			}
		}, 30_000);

		const handleVisibilityChange = () => {
			setOnlineStatus({ isOnline: !document.hidden });
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearInterval(heartbeat);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			setOnlineStatus({ isOnline: false });
		};
	}, [isAuthenticated, setOnlineStatus]);

	if (isLoading) {
		return <FullPageSpinner />;
	}

	if (!isAuthenticated) return null;

	return <CallProvider>{children}</CallProvider>;
}
