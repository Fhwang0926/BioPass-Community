import { useTranslation } from "react-i18next";

import { resolveSampleLocale, type SampleLocale } from "./integrationSamples";

/** i18n 언어 설정 → Bio-Pass 샘플/API lang (ko | en) */
export function useSampleLocale(): SampleLocale {
	const { i18n } = useTranslation();
	return resolveSampleLocale(i18n.resolvedLanguage || i18n.language);
}
