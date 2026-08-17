import { useTranslation } from "react-i18next";

import StepApprove from "@/assets/images/welcome/welcome-step-approve.jpg";
import Logo from "@/components/logo";

const { VITE_APP_TITLE } = import.meta.env;

export default function LoginHero() {
	const { t } = useTranslation();
	const title = VITE_APP_TITLE || "BioPass";
	const steps = [t("sys.welcome.step1Title"), t("sys.welcome.step2Title"), t("sys.welcome.step3Title")];

	return (
		<div className="flex w-full max-w-md flex-col items-center px-10 text-center">
			<Logo size={56} />
			<div className="mt-5 text-4xl font-bold text-gray-800">{title}</div>
			<p className="mt-3 text-base text-gray-600">{t("sys.login.heroSubtitle")}</p>

			<figure
				className="mt-8 w-full overflow-hidden rounded-2xl border border-gray-300 bg-common-white shadow-sm"
				aria-label={t("sys.login.heroBannerAria")}
			>
				<img src={StepApprove} alt={t("sys.welcome.step2Alt")} className="aspect-[4/3] w-full object-cover" />
			</figure>

			<ol className="mt-6 flex list-none flex-col gap-2 p-0 text-left text-sm text-gray-600">
				{steps.map((step, index) => (
					<li key={step} className="flex items-center gap-3">
						<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
							{index + 1}
						</span>
						<span>{step}</span>
					</li>
				))}
			</ol>
		</div>
	);
}
