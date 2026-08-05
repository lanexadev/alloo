"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../../../convex/_generated/api";

export default function InvitePage() {
	const { code } = useParams<{ code: string }>();
	const { isAuthenticated, isLoading } = useConvexAuth();
	const joinGroup = useMutation(api.conversations.joinByInviteCode);
	const router = useRouter();
	const [error, setError] = useState("");
	const [joining, setJoining] = useState(false);

	useEffect(() => {
		if (isLoading) return;

		if (!isAuthenticated) {
			// Store invite code and redirect to signup
			if (typeof window !== "undefined") {
				sessionStorage.setItem("pendingInvite", code);
			}
			return;
		}

		const autoJoin = async () => {
			setJoining(true);
			try {
				const conversationId = await joinGroup({ inviteCode: code });
				// Land directly in the group rather than on the conversation list.
				router.replace(`/chat/${conversationId}`);
			} catch (err) {
				setError(
					err instanceof Error && err.message.includes("expired")
						? "Ce lien d'invitation a expiré. Demande-en un nouveau à un admin du groupe."
						: "Ce lien d'invitation est invalide.",
				);
			} finally {
				setJoining(false);
			}
		};

		void autoJoin();
	}, [isAuthenticated, isLoading, code, joinGroup, router]);

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center px-4">
				<div className="space-y-4 text-center">
					<p className="text-destructive">{error}</p>
					<Link href="/chat">
						<Button>Retour au chat</Button>
					</Link>
				</div>
			</div>
		);
	}

	if (isLoading || joining) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-sm text-muted-foreground">
						{joining ? "Rejoindre le groupe..." : "Chargement..."}
					</p>
				</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className="flex min-h-screen items-center justify-center px-4">
				<div className="w-full max-w-sm space-y-6 text-center">
					<div className="flex justify-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
							<Users className="h-8 w-8 text-primary" />
						</div>
					</div>
					<div>
						<h1 className="text-2xl font-bold">Tu as été invité !</h1>
						<p className="mt-2 text-muted-foreground">
							Crée un compte pour rejoindre ce groupe sur Alloo
						</p>
					</div>
					<div className="space-y-2">
						<Link href="/signup">
							<Button className="w-full">Créer mon compte</Button>
						</Link>
						<Link href="/login">
							<Button variant="outline" className="w-full">
								J&apos;ai déjà un compte
							</Button>
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return null;
}
