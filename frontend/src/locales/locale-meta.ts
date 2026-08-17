import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/ko";

import { LocalEnum } from "#/enum";

export type AppLocale = keyof typeof LocalEnum;

export type LocaleMeta = {
	i18n: AppLocale;
	dayjs: "en" | "ko";
	bcp47: "en-US" | "ko-KR";
};

export const LOCALE_META: Record<AppLocale, LocaleMeta> = {
	[LocalEnum.en_US]: {
		i18n: LocalEnum.en_US,
		dayjs: "en",
		bcp47: "en-US",
	},
	[LocalEnum.ko_KR]: {
		i18n: LocalEnum.ko_KR,
		dayjs: "ko",
		bcp47: "ko-KR",
	},
};

const SUPPORTED: AppLocale[] = [LocalEnum.en_US, LocalEnum.ko_KR];

/** Normalize app, browser, and legacy locale spellings to an app locale. */
export function normalizeLocale(language?: string | null): AppLocale | null {
	if (!language) return null;
	const normalized = language.trim().replace(/-/g, "_").toLowerCase();
	for (const locale of SUPPORTED) {
		if (normalized === locale.toLowerCase()) return locale;
	}
	if (normalized === "ko" || normalized.startsWith("ko_")) return LocalEnum.ko_KR;
	if (normalized === "en" || normalized.startsWith("en_")) return LocalEnum.en_US;
	return null;
}

/** Follow the browser preference list instead of consulting only its first item. */
export function resolveLocaleFromNavigator(languages?: readonly string[]): AppLocale {
	const browserLanguages =
		languages ??
		(typeof navigator !== "undefined" && navigator.languages?.length
			? navigator.languages
			: typeof navigator !== "undefined" && navigator.language
				? [navigator.language]
				: []);

	for (const language of browserLanguages) {
		const locale = normalizeLocale(language);
		if (locale) return locale;
	}
	return LocalEnum.en_US;
}

export function getLocaleMeta(locale: string | null | undefined): LocaleMeta {
	const normalized = normalizeLocale(locale);
	if (normalized) return LOCALE_META[normalized];
	return LOCALE_META[LocalEnum.en_US];
}

/** Sync document lang + dayjs for the active app locale. */
export function applyLocaleRuntime(locale: AppLocale) {
	const meta = getLocaleMeta(locale);
	if (typeof document !== "undefined") {
		document.documentElement.lang = meta.bcp47;
	}
	dayjs.locale(meta.dayjs);
}

export function formatNumber(value: number, locale?: string | null, options?: Intl.NumberFormatOptions) {
	return new Intl.NumberFormat(getLocaleMeta(locale).bcp47, options).format(value);
}

export function formatDateTime(
	value: Date | number | string,
	locale?: string | null,
	options?: Intl.DateTimeFormatOptions,
) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat(getLocaleMeta(locale).bcp47, options).format(date);
}
