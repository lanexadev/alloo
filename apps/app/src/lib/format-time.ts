export function formatLastSeen(timestamp: number | undefined): string {
	if (!timestamp) return "Jamais vu";

	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return "En ligne";
	if (minutes < 60) return `Vu il y a ${minutes}min`;
	if (hours < 24) return `Vu il y a ${hours}h`;
	if (days === 1) return "Vu hier";
	if (days < 7) return `Vu il y a ${days}j`;

	return new Date(timestamp).toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
	});
}

export function formatMessageTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("fr-FR", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Midnight-to-midnight distance, so "hier" means the calendar day, not 24h. */
function daysApart(from: Date, to: Date): number {
	const startOfFrom = new Date(
		from.getFullYear(),
		from.getMonth(),
		from.getDate(),
	).getTime();
	const startOfTo = new Date(
		to.getFullYear(),
		to.getMonth(),
		to.getDate(),
	).getTime();
	return Math.round((startOfTo - startOfFrom) / 86_400_000);
}

/**
 * Label for the divider that opens a new day in the message list, e.g.
 * "Aujourd'hui", "Hier", "lundi 4 août" or "4 août 2025" for another year.
 */
export function formatDateSeparator(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const days = daysApart(date, now);

	if (days === 0) return "Aujourd'hui";
	if (days === 1) return "Hier";

	if (date.getFullYear() !== now.getFullYear()) {
		return date.toLocaleDateString("fr-FR", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	}

	return date.toLocaleDateString("fr-FR", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

/** True when the two timestamps do not fall on the same calendar day. */
export function isNewDay(previous: number, current: number): boolean {
	return daysApart(new Date(previous), new Date(current)) !== 0;
}

/** Expiry wording for invite links, e.g. "expire le 12 août à 14:30". */
export function formatExpiry(timestamp: number | undefined): string {
	if (timestamp === undefined) return "n'expire pas";
	if (timestamp <= Date.now()) return "expiré";

	const date = new Date(timestamp).toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
	});
	const time = new Date(timestamp).toLocaleTimeString("fr-FR", {
		hour: "2-digit",
		minute: "2-digit",
	});
	return `expire le ${date} à ${time}`;
}
