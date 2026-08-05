"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthDivider, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
	const { signIn } = useAuthActions();
	const { isAuthenticated } = useConvexAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (isAuthenticated) router.replace("/setup-profile");
	}, [isAuthenticated, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (password.length < 8) {
			setError("Le mot de passe doit contenir au moins 8 caractères");
			return;
		}
		if (password !== confirmPassword) {
			setError("Les mots de passe ne correspondent pas");
			return;
		}

		setLoading(true);
		try {
			await signIn("password", { email, password, flow: "signUp" });
		} catch {
			setError("Cet email est déjà utilisé ou une erreur est survenue");
		} finally {
			setLoading(false);
		}
	};

	const handleOAuth = async (provider: "google" | "github") => {
		try {
			await signIn(provider);
		} catch {
			setError(`Erreur d'inscription avec ${provider}`);
		}
	};

	return (
		<AuthShell
			title="Rejoins Alloo"
			subtitle="Un compte, deux minutes, et tu discutes."
			footer={
				<>
					En créant un compte, tu acceptes nos{" "}
					<span className="underline">CGU</span> et notre{" "}
					<span className="underline">Politique de confidentialité</span>.
					<br />
					Âge minimum : 16 ans.
				</>
			}
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
					placeholder="Mot de passe (min. 8 caractères)"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					minLength={8}
				/>
				<Input
					inputSize="lg"
					type="password"
					placeholder="Confirmer le mot de passe"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
					minLength={8}
				/>

				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}

				<Button type="submit" size="xl" className="w-full" disabled={loading}>
					{loading ? "Création…" : "Créer mon compte"}
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
				Déjà un compte ?{" "}
				<Link
					href="/login"
					className="font-semibold text-primary hover:underline"
				>
					Se connecter
				</Link>
			</p>
		</AuthShell>
	);
}
