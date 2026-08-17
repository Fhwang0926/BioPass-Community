import { useTranslation } from "react-i18next";

import CyanBlur from "@/assets/images/background/cyan-blur.png";
import RedBlur from "@/assets/images/background/red-blur.png";
import StepApprove from "@/assets/images/welcome/welcome-step-approve.jpg";
import StepRequest from "@/assets/images/welcome/welcome-step-request.jpg";
import StepSignedIn from "@/assets/images/welcome/welcome-step-signedin.jpg";
import Logo from "@/components/logo";

import { track, viewport } from "./login-hero.css";

const { VITE_APP_TITLE } = import.meta.env;

export default function LoginHero() {
	const { t } = useTranslation();
	const title = VITE_APP_TITLE || "BioPass";
	const slides = [
		{
			image: StepRequest,
			alt: t("sys.welcome.step1Alt"),
			caption: t("sys.welcome.step1Title"),
		},
		{
			image: StepApprove,
			alt: t("sys.welcome.step2Alt"),
			caption: t("sys.welcome.step2Title"),
		},
		{
			image: StepSignedIn,
			alt: t("sys.welcome.step3Alt"),
			caption: t("sys.welcome.step3Title"),
		},
	];

	return (
		<div className="relative flex h-full w-full flex-col justify-center overflow-hidden">
			<img
				src={CyanBlur}
				alt=""
				aria-hidden
				className="pointer-events-none absolute -left-24 -top-24 w-[420px] opacity-70"
			/>
			<img
				src={RedBlur}
				alt=""
				aria-hidden
				className="pointer-events-none absolute -bottom-28 -right-16 w-[380px] opacity-50"
			/>

			<div className="relative z-[1] mb-8 px-10 text-center">
				<div className="mb-5 flex justify-center">
					<Logo size={64} />
				</div>
				<div className="mb-3 text-4xl font-bold text-gray-900 xl:text-5xl">{title}</div>
				<p className="mx-auto max-w-md text-base text-gray-600 xl:text-lg">{t("sys.login.heroSubtitle")}</p>
				<p className="mt-6 text-xs font-semibold uppercase tracking-wide text-primary">
					{t("sys.welcome.howItWorksTitle")}
				</p>
			</div>

			<div className="relative z-[1] w-full" role="region" aria-label={t("sys.login.heroBannerAria")}>
				<div className={viewport}>
					<div className={track}>
						{[false, true].map((isClone) => (
							<div key={isClone ? "clone" : "source"} className="flex gap-6 pr-6" aria-hidden={isClone}>
								{slides.map((slide) => (
									<figure key={slide.caption} className="w-[min(22rem,36vw)] shrink-0">
										<div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-lg">
											<img
												src={slide.image}
												alt={isClone ? "" : slide.alt}
												className="aspect-[4/3] w-full object-cover"
											/>
										</div>
										<figcaption className="mt-3 text-center text-sm font-medium text-gray-700">
											{slide.caption}
										</figcaption>
									</figure>
								))}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
