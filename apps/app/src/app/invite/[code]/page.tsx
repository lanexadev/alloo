"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/ui/spinner";
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
			<AuthShell title="Invitation invalide">
				<p role="alert" className="text-center text-sm text-destructive">
					{error}
				</p>
				<Link href="/chat" className="block">
					<Button size="xl" className="w-full">
						Retour au chat
					</Button>
				</Link>
			</AuthShell>
		);
	}

	if (isLoading || joining) {
		return (
			<FullPageSpinner label={joining ? "On te fait entrer…" : "Chargement…"} />
		);
	}

	if (!isAuthenticated) {
		return (
			<AuthShell
				title="Tu es invité !"
				subtitle="Crée ton compte pour rejoindre ce groupe sur Alloo."
			>
				<div className="flex justify-center">
					<span className="flex size-12 items-center justify-center rounded-xl border border-border text-muted-foreground">
						<Users className="size-5" />
					</span>
				</div>
				<div className="space-y-2">
					<Link href="/signup" className="block">
						<Button size="xl" className="w-full">
							Créer mon compte
						</Button>
					</Link>
					<Link href="/login" className="block">
						<Button variant="outline" size="xl" className="w-full">
							J&apos;ai déjà un compte
						</Button>
					</Link>
				</div>
			</AuthShell>
		);
	}

	return null;
}
