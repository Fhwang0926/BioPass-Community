import en_US from "antd/locale/en_US";
import ko_KR from "antd/locale/ko_KR";
import { useTranslation } from "react-i18next";

import type { Locale as AntdLocal } from "antd/es/locale";
import { LocalEnum, StorageEnum } from "#/enum";

import {
	applyLocaleRuntime,
	getLocaleMeta,
	type AppLocale,
	type LocaleMeta,
} from "./locale-meta";

type Language = {
	locale: AppLocale;
	icon: string;
	label: string;
	/** Short label for compact switches. */
	shortLabel: string;
	antdLocal: AntdLocal;
	meta: LocaleMeta;
};

export const LANGUAGE_MAP: Record<AppLocale, Language> = {
	[LocalEnum.en_US]: {
		locale: LocalEnum.en_US,
		label: "English",
		shortLabel: "EN",
		icon: "ic-locale_en_US",
		antdLocal: en_US,
		meta: getLocaleMeta(LocalEnum.en_US),
	},
	[LocalEnum.ko_KR]: {
		locale: LocalEnum.ko_KR,
		label: "한국어",
		shortLabel: "한국어",
		icon: "ic-locale_ko_KR",
		antdLocal: ko_KR,
		meta: getLocaleMeta(LocalEnum.ko_KR),
	},
};

export default function useLocale() {
	const { i18n } = useTranslation();

	const locale = (i18n.resolvedLanguage || LocalEnum.en_US) as AppLocale;
	const language = LANGUAGE_MAP[locale] ?? LANGUAGE_MAP[LocalEnum.en_US];

	const setLocale = (next: AppLocale) => {
		// Persist explicitly. This avoids relying on detector plugin side effects
		// and keeps behavior deterministic across reloads.
		localStorage.setItem(StorageEnum.I18N, next);
		void i18n.changeLanguage(next);
		applyLocaleRuntime(next);
	};

	return {
		locale,
		language,
		meta: language.meta,
		setLocale,
	};
}
