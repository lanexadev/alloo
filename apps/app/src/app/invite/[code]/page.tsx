"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";

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

    // Auto-join if authenticated
    const autoJoin = async () => {
      setJoining(true);
      try {
        const conversationId = await joinGroup({ inviteCode: code });
        router.replace(`/chat`);
      } catch {
        setError("Ce lien d'invitation est invalide ou a expiré.");
      } finally {
        setJoining(false);
      }
    };

    autoJoin();
  }, [isAuthenticated, isLoading, code, joinGroup, router]);

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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Link href="/chat">
            <Button>Retour au chat</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
