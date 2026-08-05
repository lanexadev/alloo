/**
 * Call sound effects using Web Audio API.
 * Zero dependencies — generates tones programmatically.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
	if (!audioContext || audioContext.state === "closed") {
		audioContext = new AudioContext();
	}
	if (audioContext.state === "suspended") {
		void audioContext.resume();
	}
	return audioContext;
}

export interface SoundHandle {
	stop: () => void;
}

/**
 * Incoming call ringtone — dual-tone ringing pattern.
 * Plays 440Hz + 480Hz for 1s, pauses 2s, repeats.
 */
export function playRingtone(): SoundHandle {
	const ctx = getAudioContext();
	let stopped = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let activeNodes: AudioNode[] = [];

	function cleanup() {
		for (const node of activeNodes) {
			try {
				node.disconnect();
			} catch {
				// Already disconnected
			}
		}
		activeNodes = [];
	}

	function ring() {
		if (stopped) return;
		cleanup();

		const gain = ctx.createGain();
		gain.connect(ctx.destination);
		gain.gain.setValueAtTime(0.15, ctx.currentTime);
		gain.gain.setValueAtTime(0, ctx.currentTime + 1);

		const osc1 = ctx.createOscillator();
		osc1.type = "sine";
		osc1.frequency.value = 440;
		osc1.connect(gain);
		osc1.start(ctx.currentTime);
		osc1.stop(ctx.currentTime + 1);

		const osc2 = ctx.createOscillator();
		osc2.type = "sine";
		osc2.frequency.value = 480;
		osc2.connect(gain);
		osc2.start(ctx.currentTime);
		osc2.stop(ctx.currentTime + 1);

		activeNodes = [osc1, osc2, gain];

		osc1.onended = () => {
			cleanup();
			if (!stopped) {
				timeoutId = setTimeout(ring, 2000);
			}
		};
	}

	ring();

	return {
		stop() {
			stopped = true;
			if (timeoutId) clearTimeout(timeoutId);
			cleanup();
		},
	};
}

/**
 * Outgoing ringback tone — gentle beep while waiting for answer.
 * Single 440Hz beep for 0.5s, pause 3s, repeats.
 */
export function playRingbackTone(): SoundHandle {
	const ctx = getAudioContext();
	let stopped = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let activeNodes: AudioNode[] = [];

	function cleanup() {
		for (const node of activeNodes) {
			try {
				node.disconnect();
			} catch {
				// Already disconnected
			}
		}
		activeNodes = [];
	}

	function beep() {
		if (stopped) return;
		cleanup();

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.type = "sine";
		osc.frequency.value = 440;
		gain.gain.setValueAtTime(0.08, ctx.currentTime);
		gain.gain.setValueAtTime(0, ctx.currentTime + 0.5);

		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.5);

		activeNodes = [osc, gain];

		osc.onended = () => {
			cleanup();
			if (!stopped) {
				timeoutId = setTimeout(beep, 3000);
			}
		};
	}

	beep();

	return {
		stop() {
			stopped = true;
			if (timeoutId) clearTimeout(timeoutId);
			cleanup();
		},
	};
}

/**
 * Two ascending notes — call connected.
 */
export function playConnectedSound(): void {
	const ctx = getAudioContext();

	const gain1 = ctx.createGain();
	gain1.connect(ctx.destination);
	gain1.gain.setValueAtTime(0.15, ctx.currentTime);
	gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

	const osc1 = ctx.createOscillator();
	osc1.type = "sine";
	osc1.frequency.value = 523; // C5
	osc1.connect(gain1);
	osc1.start(ctx.currentTime);
	osc1.stop(ctx.currentTime + 0.15);

	const gain2 = ctx.createGain();
	gain2.connect(ctx.destination);
	gain2.gain.setValueAtTime(0, ctx.currentTime);
	gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
	gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

	const osc2 = ctx.createOscillator();
	osc2.type = "sine";
	osc2.frequency.value = 659; // E5
	osc2.connect(gain2);
	osc2.start(ctx.currentTime + 0.12);
	osc2.stop(ctx.currentTime + 0.3);

	osc1.onended = () => {
		osc1.disconnect();
		gain1.disconnect();
	};
	osc2.onended = () => {
		osc2.disconnect();
		gain2.disconnect();
	};
}

/**
 * Descending tone — call ended / disconnected.
 */
export function playEndSound(): void {
	const ctx = getAudioContext();

	const gain = ctx.createGain();
	gain.connect(ctx.destination);
	gain.gain.setValueAtTime(0.15, ctx.currentTime);
	gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(500, ctx.currentTime);
	osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.3);
	osc.connect(gain);
	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.3);

	osc.onended = () => {
		osc.disconnect();
		gain.disconnect();
	};
}
