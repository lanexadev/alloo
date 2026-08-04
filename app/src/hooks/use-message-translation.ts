"use client";

import { useCallback, useState } from "react";

// Chrome/Edge built-in Translation API (window.Translator / window.LanguageDetector).
// Not yet in TypeScript's DOM lib, so we declare the minimal surface we use.
interface BrowserLanguageDetector {
	detect(
		text: string,
	): Promise<Array<{ detectedLanguage: string; confidence: number }>>;
}

interface BrowserTranslator {
	translate(text: string): Promise<string>;
}

interface TranslatorStatics {
	availability(options: {
		sourceLanguage: string;
		targetLanguage: string;
	}): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
	create(options: {
		sourceLanguage: string;
		targetLanguage: string;
	}): Promise<BrowserTranslator>;
}

interface LanguageDetectorStatics {
	create(): Promise<BrowserLanguageDetector>;
}

declare global {
	interface Window {
		Translator?: TranslatorStatics;
		LanguageDetector?: LanguageDetectorStatics;
	}
}

export type TranslationState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "translated"; text: string }
	| { status: "error"; message: string };

export function isTranslationSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		!!window.Translator &&
		!!window.LanguageDetector
	);
}

/**
 * Translates a message to the user's UI language using the browser's
 * built-in Translation API. Unsupported browsers get an explicit error state.
 */
export function useMessageTranslation(content: string) {
	const [state, setState] = useState<TranslationState>({ status: "idle" });

	const reset = useCallback(() => setState({ status: "idle" }), []);

	const translate = useCallback(async () => {
		if (!isTranslationSupported()) {
			setState({
				status: "error",
				message:
					"Traduction non disponible sur ce navigateur (essaie Chrome ou Edge récent).",
			});
			return;
		}

		setState({ status: "loading" });
		try {
			const targetLanguage = navigator.language.split("-")[0] || "fr";

			const detector = await window.LanguageDetector!.create();
			const detections = await detector.detect(content);
			const sourceLanguage = detections[0]?.detectedLanguage;
			if (!sourceLanguage || sourceLanguage === "und") {
				setState({
					status: "error",
					message: "Langue du message non détectée.",
				});
				return;
			}
			if (sourceLanguage === targetLanguage) {
				setState({
					status: "error",
					message: "Ce message est déjà dans ta langue.",
				});
				return;
			}

			const availability = await window.Translator!.availability({
				sourceLanguage,
				targetLanguage,
			});
			if (availability === "unavailable") {
				setState({
					status: "error",
					message: `Traduction ${sourceLanguage} → ${targetLanguage} non disponible.`,
				});
				return;
			}

			// "downloadable"/"downloading": create() triggers/waits for the model download
			const translator = await window.Translator!.create({
				sourceLanguage,
				targetLanguage,
			});
			const text = await translator.translate(content);
			setState({ status: "translated", text });
		} catch {
			setState({ status: "error", message: "La traduction a échoué." });
		}
	}, [content]);

	return { state, translate, reset };
}
