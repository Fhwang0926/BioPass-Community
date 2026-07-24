import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { getStringItem } from "@/utils/storage";

import en_US from "./lang/en_US";
import ko_KR from "./lang/ko_KR";

import { LocalEnum, StorageEnum } from "#/enum";

const storedLng = getStringItem(StorageEnum.I18N);
const supportedLocales: LocalEnum[] = [LocalEnum.en_US, LocalEnum.ko_KR];
const defaultLng = supportedLocales.includes(storedLng as LocalEnum)
	? (storedLng as LocalEnum)
	: LocalEnum.en_US;

document.documentElement.lang = defaultLng;

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
		},
	});

export default i18n;
export const { t } = i18n;
