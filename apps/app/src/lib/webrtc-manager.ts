/**
 * 1:1 WebRTC peer connection using the "perfect negotiation" pattern.
 *
 * A single {@link RTCPeerConnection} connects the local user to exactly one peer.
 * Negotiation is symmetric and glare-proof: one side is designated `polite` and
 * rolls back on offer collisions, the other is `impolite` and ignores them.
 * See https://developer.mozilla.org/docs/Web/API/WebRTC_API/Perfect_negotiation
 *
 * Convention in this app: the callee (incoming) is polite, the caller (outgoing)
 * is impolite. In the normal flow only the caller ever offers, so collisions are
 * rare — but perfect negotiation keeps re-negotiation (e.g. screen share) safe.
 */

export type SignalType = "offer" | "answer" | "ice-candidate";

interface WebRTCManagerConfig {
	/** True for the callee (incoming), false for the caller (outgoing). */
	polite: boolean;
	/**
	 * ICE servers for this connection, minted server-side by `turn.getIceServers`.
	 * Falls back to {@link FALLBACK_ICE_SERVERS} when omitted, which only connects
	 * peers that are directly reachable — see the note on that constant.
	 */
	iceServers?: RTCIceServer[];
	/** Relay an SDP description or ICE candidate to the peer. */
	onSignal: (type: SignalType, payload: string) => void;
	/** The peer's combined media stream became available. */
	onRemoteStream: (stream: MediaStream) => void;
	/** Underlying RTCPeerConnection state changed. */
	onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

/**
 * Last-resort configuration when the server returns nothing.
 *
 * STUN alone fails behind symmetric NAT and most corporate firewalls: without a
 * TURN relay those calls never connect. Configure TURN on the Convex deployment
 * (see convex/turn.ts) so real users are not left on this path.
 */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:stun1.l.google.com:19302" },
];

export class WebRTCManager {
	private pc: RTCPeerConnection;
	private readonly polite: boolean;
	private readonly config: WebRTCManagerConfig;

	private localStream: MediaStream | null = null;
	private screenStream: MediaStream | null = null;
	private remoteStream: MediaStream;

	// Perfect negotiation bookkeeping.
	private makingOffer = false;
	private ignoreOffer = false;
	private isSettingRemoteAnswerPending = false;

	// ICE candidates that arrive before the remote description is set.
	private pendingCandidates: RTCIceCandidateInit[] = [];
	private destroyed = false;

	constructor(config: WebRTCManagerConfig) {
		this.config = config;
		this.polite = config.polite;
		this.remoteStream = new MediaStream();
		this.pc = this.createPeerConnection();
	}

	private createPeerConnection(): RTCPeerConnection {
		const pc = new RTCPeerConnection({
			iceServers: this.config.iceServers ?? FALLBACK_ICE_SERVERS,
		});

		pc.onnegotiationneeded = async () => {
			try {
				this.makingOffer = true;
				await pc.setLocalDescription();
				if (pc.localDescription) {
					this.config.onSignal(
						pc.localDescription.type as SignalType,
						JSON.stringify(pc.localDescription),
					);
				}
			} catch (err) {
				console.error("[webrtc] negotiation failed:", err);
			} finally {
				this.makingOffer = false;
			}
		};

		pc.onicecandidate = ({ candidate }) => {
			if (candidate && !this.destroyed) {
				this.config.onSignal("ice-candidate", JSON.stringify(candidate));
			}
		};

		pc.ontrack = ({ track }) => {
			if (this.destroyed) return;
			this.remoteStream.addTrack(track);
			this.config.onRemoteStream(this.remoteStream);
		};

		pc.onconnectionstatechange = () => {
			this.config.onConnectionStateChange?.(pc.connectionState);
		};

		return pc;
	}

	// ---------------------------------------------------------------------------
	// Media
	// ---------------------------------------------------------------------------

	/** Acquire the local mic (+camera for video calls). Does not attach tracks. */
	async acquireMedia(video: boolean): Promise<MediaStream> {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
		});
		this.localStream = stream;
		return stream;
	}

	getLocalStream(): MediaStream | null {
		return this.localStream;
	}

	/**
	 * Attach local tracks to the connection, which triggers `negotiationneeded`
	 * on the impolite (caller) side and starts the SDP exchange. Idempotent.
	 */
	start(): void {
		if (!this.localStream) return;
		const senders = this.pc.getSenders();
		for (const track of this.localStream.getTracks()) {
			const alreadySent = senders.some((s) => s.track === track);
			if (!alreadySent) this.pc.addTrack(track, this.localStream);
		}
	}

	// ---------------------------------------------------------------------------
	// Inbound signaling
	// ---------------------------------------------------------------------------

	async handleDescription(raw: string): Promise<void> {
		if (this.destroyed) return;
		const description: RTCSessionDescriptionInit = JSON.parse(raw);

		const readyForOffer =
			!this.makingOffer &&
			(this.pc.signalingState === "stable" ||
				this.isSettingRemoteAnswerPending);
		const offerCollision = description.type === "offer" && !readyForOffer;

		this.ignoreOffer = !this.polite && offerCollision;
		if (this.ignoreOffer) return;

		this.isSettingRemoteAnswerPending = description.type === "answer";
		await this.pc.setRemoteDescription(description);
		this.isSettingRemoteAnswerPending = false;

		await this.flushCandidates();

		if (description.type === "offer") {
			await this.pc.setLocalDescription();
			if (this.pc.localDescription) {
				this.config.onSignal(
					this.pc.localDescription.type as SignalType,
					JSON.stringify(this.pc.localDescription),
				);
			}
		}
	}

	async handleCandidate(raw: string): Promise<void> {
		if (this.destroyed) return;
		const candidate: RTCIceCandidateInit = JSON.parse(raw);

		// Buffer candidates that arrive before the remote description is set.
		if (!this.pc.remoteDescription) {
			this.pendingCandidates.push(candidate);
			return;
		}
		try {
			await this.pc.addIceCandidate(candidate);
		} catch (err) {
			if (!this.ignoreOffer) throw err;
		}
	}

	private async flushCandidates(): Promise<void> {
		if (this.pendingCandidates.length === 0) return;
		const buffered = this.pendingCandidates;
		this.pendingCandidates = [];
		for (const candidate of buffered) {
			try {
				await this.pc.addIceCandidate(candidate);
			} catch (err) {
				if (!this.ignoreOffer) console.error("[webrtc] addIceCandidate:", err);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Media controls
	// ---------------------------------------------------------------------------

	/** @returns true if now muted. */
	setMuted(muted: boolean): void {
		for (const track of this.localStream?.getAudioTracks() ?? []) {
			track.enabled = !muted;
		}
	}

	/** @param off true to disable the camera. */
	setCameraOff(off: boolean): void {
		for (const track of this.localStream?.getVideoTracks() ?? []) {
			track.enabled = !off;
		}
	}

	async startScreenShare(): Promise<void> {
		const screenStream = await navigator.mediaDevices.getDisplayMedia({
			video: true,
			audio: false,
		});
		this.screenStream = screenStream;
		const screenTrack = screenStream.getVideoTracks()[0];
		if (!screenTrack) throw new Error("No screen track");

		screenTrack.onended = () => void this.stopScreenShare();

		const videoSender = this.pc
			.getSenders()
			.find((s) => s.track?.kind === "video");
		if (videoSender) {
			await videoSender.replaceTrack(screenTrack);
		} else {
			this.pc.addTrack(screenTrack, screenStream);
		}
	}

	async stopScreenShare(): Promise<void> {
		if (!this.screenStream) return;
		const cameraTrack = this.localStream?.getVideoTracks()[0] ?? null;
		const videoSender = this.pc
			.getSenders()
			.find((s) => s.track?.kind === "video");

		if (videoSender) {
			// Restore the camera track (or clear it for audio calls) before stopping.
			await videoSender.replaceTrack(cameraTrack).catch(() => {});
		}
		for (const track of this.screenStream.getTracks()) track.stop();
		this.screenStream = null;
	}

	// ---------------------------------------------------------------------------
	// Teardown
	// ---------------------------------------------------------------------------

	destroy(): void {
		this.destroyed = true;
		this.pc.onnegotiationneeded = null;
		this.pc.onicecandidate = null;
		this.pc.ontrack = null;
		this.pc.onconnectionstatechange = null;
		this.pc.close();

		for (const track of this.localStream?.getTracks() ?? []) track.stop();
		for (const track of this.screenStream?.getTracks() ?? []) track.stop();
		for (const track of this.remoteStream.getTracks())
			this.remoteStream.removeTrack(track);

		this.localStream = null;
		this.screenStream = null;
		this.pendingCandidates = [];
	}
}
