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
