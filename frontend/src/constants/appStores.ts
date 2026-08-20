/** Companion mobile app store listings (Bio Pass). */
export const APP_STORE_URL =
	import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com/br/app/bio-pass/id6760216314";

/** Google Play listing (override with VITE_PLAY_STORE_URL when the real app is published). */
export const PLAY_STORE_URL = (
	import.meta.env.VITE_PLAY_STORE_URL ||
	"https://play.google.com/store/apps/details?id=kr.go.minwon.m&hl=ko"
).trim();
