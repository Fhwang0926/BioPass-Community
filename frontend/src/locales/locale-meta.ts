import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/es";
import "dayjs/locale/fr";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/zh-cn";

import { LocalEnum } from "#/enum";

export type AppLocale = keyof typeof LocalEnum;

export type LocaleMeta = {
	i18n: AppLocale;
	dayjs: "en" | "ko" | "ja" | "zh-cn" | "es" | "fr";
	bcp47: "en-US" | "ko-KR" | "ja-JP" | "zh-CN" | "es-ES" | "fr-FR";
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
	[LocalEnum.ja_JP]: {
		i18n: LocalEnum.ja_JP,
		dayjs: "ja",
		bcp47: "ja-JP",
	},
	[LocalEnum.zh_CN]: {
		i18n: LocalEnum.zh_CN,
		dayjs: "zh-cn",
		bcp47: "zh-CN",
	},
	[LocalEnum.es_ES]: {
		i18n: LocalEnum.es_ES,
		dayjs: "es",
		bcp47: "es-ES",
	},
	[LocalEnum.fr_FR]: {
		i18n: LocalEnum.fr_FR,
		dayjs: "fr",
		bcp47: "fr-FR",
	},
};

const SUPPORTED: AppLocale[] = [
	LocalEnum.en_US,
	LocalEnum.ko_KR,
	LocalEnum.ja_JP,
	LocalEnum.zh_CN,
	LocalEnum.es_ES,
	LocalEnum.fr_FR,
];

/** Normalize app, browser, and legacy locale spellings to an app locale. */
export function normalizeLocale(language?: string | null): AppLocale | null {
	if (!language) return null;
	const normalized = language.trim().replace(/-/g, "_").toLowerCase();
	for (const locale of SUPPORTED) {
		if (normalized === locale.toLowerCase()) return locale;
	}
	if (normalized === "ko" || normalized.startsWith("ko_")) return LocalEnum.ko_KR;
	if (normalized === "ja" || normalized.startsWith("ja_")) return LocalEnum.ja_JP;
	if (normalized === "zh_tw" || normalized.startsWith("zh_hant") || normalized === "zh_hk") {
		return LocalEnum.zh_CN;
	}
	if (normalized === "zh" || normalized.startsWith("zh_")) return LocalEnum.zh_CN;
	if (normalized === "es" || normalized.startsWith("es_")) return LocalEnum.es_ES;
	if (normalized === "fr" || normalized.startsWith("fr_")) return LocalEnum.fr_FR;
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
