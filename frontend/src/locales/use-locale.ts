import en_US from "antd/locale/en_US";
import ko_KR from "antd/locale/ko_KR";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import type { Locale as AntdLocal } from "antd/es/locale";
import { LocalEnum } from "#/enum";

type Locale = keyof typeof LocalEnum;
type Language = {
	locale: keyof typeof LocalEnum;
	icon: string;
	label: string;
	antdLocal: AntdLocal;
};

export const LANGUAGE_MAP: Record<Locale, Language> = {
	[LocalEnum.en_US]: {
		locale: LocalEnum.en_US,
		label: "English",
		icon: "ic-locale_en_US",
		antdLocal: en_US,
	},
	[LocalEnum.ko_KR]: {
		locale: LocalEnum.ko_KR,
		label: "한국어",
		icon: "ic-locale_ko_KR",
		antdLocal: ko_KR,
	},
};

export default function useLocale() {
	const { i18n } = useTranslation();

	const locale = (i18n.resolvedLanguage || LocalEnum.en_US) as Locale;
	const language = LANGUAGE_MAP[locale] ?? LANGUAGE_MAP[LocalEnum.en_US];

	/**
	 * localstorage -> i18nextLng change
	 */
	const setLocale = (locale: Locale) => {
		i18n.changeLanguage(locale);
		document.documentElement.lang = locale;
		dayjs.locale(locale);
	};

	return {
		locale,
		language,
		setLocale,
	};
}
