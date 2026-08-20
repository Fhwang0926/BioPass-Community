import { useTranslation } from "react-i18next";

import { type SampleLocale, resolveSampleLocale } from "./integrationSamples";

/** i18n language → BioPass sample/API lang (ko | en). ja/zh/es/fr fall back to English. */
export function useSampleLocale(): SampleLocale {
	const { i18n } = useTranslation();
	return resolveSampleLocale(i18n.resolvedLanguage || i18n.language);
}
