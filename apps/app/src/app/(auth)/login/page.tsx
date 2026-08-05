"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthDivider, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
	const { signIn } = useAuthActions();
	const { isAuthenticated } = useConvexAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (isAuthenticated) router.replace("/chat"); // chat page handles profile/onboarding redirects
	}, [isAuthenticated, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await signIn("password", { email, password, flow: "signIn" });
		} catch {
			setError("Email ou mot de passe incorrect");
		} finally {
			setLoading(false);
		}
	};

	const handleOAuth = async (provider: "google" | "github") => {
		try {
			await signIn(provider);
		} catch {
			setError(`Erreur de connexion avec ${provider}`);
		}
	};

	return (
		<AuthShell
			title="Content de te revoir"
			subtitle="Reprends tes conversations là où tu les as laissées."
		>
			<form onSubmit={handleSubmit} className="space-y-3">
				<Input
					inputSize="lg"
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<Input
					inputSize="lg"
					type="password"
					placeholder="Mot de passe"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					minLength={8}
				/>

				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}

				<Button type="submit" size="xl" className="w-full" disabled={loading}>
					{loading ? "Connexion…" : "Se connecter"}
				</Button>
			</form>

			<AuthDivider />

			<div className="space-y-2">
				<Button
					variant="outline"
					size="xl"
					className="w-full"
					onClick={() => handleOAuth("google")}
				>
					Continuer avec Google
				</Button>
				<Button
					variant="outline"
					size="xl"
					className="w-full"
					onClick={() => handleOAuth("github")}
				>
					Continuer avec GitHub
				</Button>
			</div>

			<p className="text-center text-sm text-muted-foreground">
				Pas encore de compte ?{" "}
				<Link
					href="/signup"
					className="font-semibold text-primary hover:underline"
				>
					S&apos;inscrire
				</Link>
			</p>
		</AuthShell>
	);
}
