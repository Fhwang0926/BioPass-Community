import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getStringItem } from "@/utils/storage";

import en_US from "./lang/en_US";
import es_ES from "./lang/es_ES";
import fr_FR from "./lang/fr_FR";
import ja_JP from "./lang/ja_JP";
import ko_KR from "./lang/ko_KR";
import zh_CN from "./lang/zh_CN";
import { type AppLocale, applyLocaleRuntime, normalizeLocale, resolveLocaleFromNavigator } from "./locale-meta";

import { LocalEnum, StorageEnum } from "#/enum";

const supportedLocales: AppLocale[] = [
	LocalEnum.en_US,
	LocalEnum.ko_KR,
	LocalEnum.ja_JP,
	LocalEnum.zh_CN,
	LocalEnum.es_ES,
	LocalEnum.fr_FR,
];
const storedLng = normalizeLocale(getStringItem(StorageEnum.I18N));

/** Prefer saved preference; otherwise honor browser language. */
const defaultLng: AppLocale = storedLng ?? resolveLocaleFromNavigator();

applyLocaleRuntime(defaultLng);

i18n.use(initReactI18next).init({
	debug: import.meta.env.DEV && import.meta.env.VITE_I18N_DEBUG === "true",
	lng: defaultLng,
	fallbackLng: LocalEnum.en_US,
	supportedLngs: supportedLocales,
	interpolation: {
		escapeValue: false,
	},
	resources: {
		en_US: { translation: en_US },
		ko_KR: { translation: ko_KR },
		ja_JP: { translation: ja_JP },
		zh_CN: { translation: zh_CN },
		es_ES: { translation: es_ES },
		fr_FR: { translation: fr_FR },
	},
	react: {
		useSuspense: false,
	},
});

i18n.on("languageChanged", (lng) => {
	const locale = normalizeLocale(lng);
	if (locale) {
		localStorage.setItem(StorageEnum.I18N, locale);
		applyLocaleRuntime(locale);
	}
});

export default i18n;
export const { t } = i18n;
