/** Ports the end-to-end run drives. Override to point at an already-running stack. */
const APP_PORT = Number(process.env.ALLOO_APP_PORT ?? 3000);
const LANDING_PORT = Number(process.env.ALLOO_LANDING_PORT ?? 3001);

export const APP_URL = `http://127.0.0.1:${APP_PORT}`;
export const LANDING_URL = `http://127.0.0.1:${LANDING_PORT}`;

/**
 * The suite runs without a Convex deployment, so it covers what renders before
 * any backend round-trip: the landing page and the app's public auth routes.
 * This placeholder only has to be a well-formed Convex URL for the client to
 * build; nothing in these specs waits on it to connect.
 */
export const PLACEHOLDER_CONVEX_URL = "https://placeholder.convex.cloud";
