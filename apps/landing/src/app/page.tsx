import { APP_URL, REPO_URL } from "@/lib/config";

const PILLARS = [
	{
		title: "Messages privés",
		body: "Une conversation, deux personnes. Rien à configurer.",
	},
	{
		title: "Groupes",
		body: "Tu crées, tu partages le lien ou le QR code, c'est parti.",
	},
	{
		title: "Dans le navigateur",
		body: "Même adresse sur mobile et sur desktop. Aucun téléchargement.",
	},
];

/** The mocked conversation shown in the hero — pure decoration. */
const DEMO_MESSAGES = [
	{ from: "them" as const, text: "On se cale un truc ce week-end ?" },
	{ from: "me" as const, text: "Oui — samedi après-midi ?" },
	{ from: "them" as const, text: "Parfait 👌" },
];

export default function LandingPage() {
	return (
		<main className="relative min-h-dvh overflow-hidden px-6 py-16 sm:py-24">
			<div className="relative mx-auto flex w-full max-w-5xl flex-col items-center">
				<header className="animate-rise flex flex-col items-center text-center">
					<p className="text-xl font-bold tracking-tight text-primary">Alloo</p>

					<h1 className="mt-8 max-w-2xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
						Juste discuter.
						<br />
						<span className="text-primary">Rien d&apos;autre.</span>
					</h1>
					<p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground sm:text-xl">
						Pas de bots, pas de stories, pas de mini-apps. Un chat qui fait une
						seule chose et la fait bien.
					</p>

					<div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
						<a
							href={APP_URL}
							className="rounded-lg bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							Ouvrir Alloo
						</a>
						<a
							href={REPO_URL}
							className="rounded-lg border bg-card px-7 py-3.5 text-base font-medium transition hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							Voir le code
						</a>
					</div>
				</header>

				<section
					aria-label="Aperçu de l'application"
					className="animate-rise rounded-brand mt-20 w-full max-w-md border bg-card p-5 [animation-delay:150ms] sm:p-6"
				>
					<div className="flex items-center gap-3 border-b pb-4">
						<span
							aria-hidden
							className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
						>
							CL
						</span>
						<div>
							<p className="text-sm font-semibold leading-tight">Camille</p>
							<p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
								<span aria-hidden className="size-1.5 rounded-full bg-online" />
								en ligne
							</p>
						</div>
					</div>

					<ol className="mt-5 flex flex-col gap-2">
						{DEMO_MESSAGES.map((message) => (
							<li
								key={message.text}
								className={
									message.from === "me"
										? "flex justify-end"
										: "flex justify-start"
								}
							>
								<p
									className={`rounded-bubble max-w-[80%] px-3.5 py-2 text-[15px] ${
										message.from === "me"
											? "rounded-br-md bg-primary text-primary-foreground"
											: "rounded-bl-md border bg-surface-sunken"
									}`}
								>
									{message.text}
								</p>
							</li>
						))}
					</ol>
				</section>

				<section
					aria-label="Ce que fait Alloo"
					className="animate-rise mt-20 grid w-full gap-4 [animation-delay:300ms] sm:grid-cols-3"
				>
					{PILLARS.map((pillar) => (
						<article
							key={pillar.title}
							className="rounded-brand border bg-card p-6"
						>
							<h2 className="text-base font-semibold tracking-tight">
								{pillar.title}
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								{pillar.body}
							</p>
						</article>
					))}
				</section>

				<footer className="mt-20 text-center text-sm text-muted-foreground">
					<p>Gratuit. Sans pub. Sans tracking.</p>
				</footer>
			</div>
		</main>
	);
}
