/** Companion mobile app store listings (Bio Pass). */
export const APP_STORE_URL =
	import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com/br/app/bio-pass/id6760216314";

/** Google Play — set when published (empty hides the CTA). */
export const PLAY_STORE_URL = (import.meta.env.VITE_PLAY_STORE_URL || "").trim();
