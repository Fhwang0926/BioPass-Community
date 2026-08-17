import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getStringItem } from "@/utils/storage";

import en_US from "./lang/en_US";
import ko_KR from "./lang/ko_KR";
import {
	applyLocaleRuntime,
	normalizeLocale,
	resolveLocaleFromNavigator,
	type AppLocale,
} from "./locale-meta";

import { LocalEnum, StorageEnum } from "#/enum";

const supportedLocales: AppLocale[] = [LocalEnum.en_US, LocalEnum.ko_KR];
const storedLng = normalizeLocale(getStringItem(StorageEnum.I18N));

/** Prefer saved preference; otherwise honor browser language. */
const defaultLng: AppLocale = storedLng ?? resolveLocaleFromNavigator();

applyLocaleRuntime(defaultLng);

i18n
	.use(initReactI18next)
	.init({
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
