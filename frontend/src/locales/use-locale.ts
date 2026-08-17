import en_US from "antd/locale/en_US";
import es_ES from "antd/locale/es_ES";
import fr_FR from "antd/locale/fr_FR";
import ja_JP from "antd/locale/ja_JP";
import ko_KR from "antd/locale/ko_KR";
import zh_CN from "antd/locale/zh_CN";
import { useTranslation } from "react-i18next";

import type { Locale as AntdLocal } from "antd/es/locale";
import { LocalEnum, StorageEnum } from "#/enum";

import { type AppLocale, type LocaleMeta, applyLocaleRuntime, getLocaleMeta } from "./locale-meta";

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
	[LocalEnum.ja_JP]: {
		locale: LocalEnum.ja_JP,
		label: "日本語",
		shortLabel: "JP",
		icon: "ic-locale_ja_JP",
		antdLocal: ja_JP,
		meta: getLocaleMeta(LocalEnum.ja_JP),
	},
	[LocalEnum.zh_CN]: {
		locale: LocalEnum.zh_CN,
		label: "简体中文",
		shortLabel: "中文",
		icon: "ic-locale_zh_CN",
		antdLocal: zh_CN,
		meta: getLocaleMeta(LocalEnum.zh_CN),
	},
	[LocalEnum.es_ES]: {
		locale: LocalEnum.es_ES,
		label: "Español",
		shortLabel: "ES",
		icon: "ic-locale_es_ES",
		antdLocal: es_ES,
		meta: getLocaleMeta(LocalEnum.es_ES),
	},
	[LocalEnum.fr_FR]: {
		locale: LocalEnum.fr_FR,
		label: "Français",
		shortLabel: "FR",
		icon: "ic-locale_fr_FR",
		antdLocal: fr_FR,
		meta: getLocaleMeta(LocalEnum.fr_FR),
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
