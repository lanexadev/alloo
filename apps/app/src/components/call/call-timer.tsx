"use client";

import { useEffect, useState } from "react";

interface CallTimerProps {
	startedAt: number;
	className?: string;
}

function formatDuration(seconds: number): string {
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	const pad = (n: number) => n.toString().padStart(2, "0");

	if (hrs > 0) {
		return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
	}
	return `${pad(mins)}:${pad(secs)}`;
}

export function CallTimer({ startedAt, className }: CallTimerProps) {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const update = () => {
			setElapsed(Math.floor((Date.now() - startedAt) / 1000));
		};

		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [startedAt]);

	return <span className={className}>{formatDuration(elapsed)}</span>;
}
