"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "@/components/ui/spinner";

export default function Home() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	const router = useRouter();

	useEffect(() => {
		if (isLoading) return;
		if (isAuthenticated) {
			router.replace("/chat");
		} else {
			router.replace("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	return <FullPageSpinner label="Chargement…" />;
}
