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
			<div
				aria-hidden
				className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
			/>

			<div className="relative mx-auto flex w-full max-w-5xl flex-col items-center">
				<header className="animate-rise flex flex-col items-center text-center">
					<p className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
						Alloo
					</p>
					<h1 className="mt-6 max-w-2xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
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
							className="rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							Ouvrir Alloo
						</a>
						<a
							href={REPO_URL}
							className="rounded-full border px-8 py-4 text-base font-semibold transition hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							Voir le code
						</a>
					</div>
				</header>

				<section
					aria-label="Aperçu de l'application"
					className="animate-rise mt-20 w-full max-w-md rounded-brand border bg-card p-5 shadow-xl [animation-delay:150ms] sm:p-6"
				>
					<div className="flex items-center gap-3 border-b pb-4">
						<span
							aria-hidden
							className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
						>
							CL
						</span>
						<div>
							<p className="font-semibold leading-tight">Camille</p>
							<p className="text-sm text-muted-foreground">en ligne</p>
						</div>
					</div>

					<ol className="mt-5 flex flex-col gap-3">
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
									className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] ${
										message.from === "me"
											? "bg-primary text-primary-foreground"
											: "bg-background"
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
							<h2 className="text-lg font-semibold">{pillar.title}</h2>
							<p className="mt-2 text-muted-foreground">{pillar.body}</p>
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
