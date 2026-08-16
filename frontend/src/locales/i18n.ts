import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { getStringItem } from "@/utils/storage";

import en_US from "./lang/en_US";
import ko_KR from "./lang/ko_KR";
import {
	applyLocaleRuntime,
	isAppLocale,
	resolveLocaleFromNavigator,
	type AppLocale,
} from "./locale-meta";

import { LocalEnum, StorageEnum } from "#/enum";

const supportedLocales: AppLocale[] = [LocalEnum.en_US, LocalEnum.ko_KR];
const storedLng = getStringItem(StorageEnum.I18N);

/** Prefer saved preference; otherwise honor browser language. */
const defaultLng: AppLocale = isAppLocale(storedLng)
	? storedLng
	: resolveLocaleFromNavigator();

applyLocaleRuntime(defaultLng);

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		debug: import.meta.env.DEV,
		lng: defaultLng,
		fallbackLng: LocalEnum.en_US,
		supportedLngs: supportedLocales,
		interpolation: {
			escapeValue: false,
		},
		resources: {
			en_US: { translation: en_US },
			ko_KR: { translation: ko_KR },
		},
		detection: {
			order: ["localStorage", "navigator"],
			caches: ["localStorage"],
			lookupLocalStorage: StorageEnum.I18N,
		},
	});

i18n.on("languageChanged", (lng) => {
	if (isAppLocale(lng)) applyLocaleRuntime(lng);
});

export default i18n;
export const { t } = i18n;
