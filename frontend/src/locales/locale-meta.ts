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

export function isAppLocale(value: string | null | undefined): value is AppLocale {
	return Boolean(value && SUPPORTED.includes(value as AppLocale));
}

/** Map browser language (e.g. ko, ko-KR, en-US) to an app locale. */
export function resolveLocaleFromNavigator(navLang?: string): AppLocale {
	const lang = (navLang || (typeof navigator !== "undefined" ? navigator.language : "") || "")
		.toLowerCase()
		.replace(/_/g, "-");
	if (lang.startsWith("ko")) return LocalEnum.ko_KR;
	if (lang.startsWith("en")) return LocalEnum.en_US;
	return LocalEnum.en_US;
}

export function getLocaleMeta(locale: string | null | undefined): LocaleMeta {
	if (isAppLocale(locale)) return LOCALE_META[locale];
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
