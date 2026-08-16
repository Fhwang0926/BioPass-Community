import en_US from "antd/locale/en_US";
import ko_KR from "antd/locale/ko_KR";
import { useTranslation } from "react-i18next";

import type { Locale as AntdLocal } from "antd/es/locale";
import { LocalEnum } from "#/enum";

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
	antdLocal: AntdLocal;
	meta: LocaleMeta;
};

export const LANGUAGE_MAP: Record<AppLocale, Language> = {
	[LocalEnum.en_US]: {
		locale: LocalEnum.en_US,
		label: "English",
		icon: "ic-locale_en_US",
		antdLocal: en_US,
		meta: getLocaleMeta(LocalEnum.en_US),
	},
	[LocalEnum.ko_KR]: {
		locale: LocalEnum.ko_KR,
		label: "한국어",
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
