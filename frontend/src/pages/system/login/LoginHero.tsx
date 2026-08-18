import { m, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import StepApprove from "@/assets/images/welcome/welcome-step-approve.jpg";
import StepFaceId from "@/assets/images/welcome/welcome-step-faceid.jpg";
import StepRequest from "@/assets/images/welcome/welcome-step-request.jpg";
import StepSignedIn from "@/assets/images/welcome/welcome-step-signedin.jpg";
import Logo from "@/components/logo";

const { VITE_APP_TITLE } = import.meta.env;

const HOLD_MS = 3000;
const STACK_OFFSET = 12;
const STACK_SCALE = 0.04;
const VISIBLE_BEHIND = 2;

const SPRING_LIFT = { type: "spring", stiffness: 340, damping: 28, mass: 0.72 } as const;
const SPRING_STACK = { type: "spring", stiffness: 210, damping: 24, mass: 0.9 } as const;

const STEP_META = [
	{
		image: StepRequest,
		titleKey: "sys.welcome.step1Title",
		altKey: "sys.welcome.step1Alt",
		step: 1,
	},
	{
		image: StepApprove,
		titleKey: "sys.welcome.step2FingerprintTitle",
		altKey: "sys.welcome.step2Alt",
		step: 2,
	},
	{
		image: StepFaceId,
		titleKey: "sys.welcome.step2FaceIdTitle",
		altKey: "sys.welcome.step2FaceIdAlt",
		step: 2,
	},
	{
		image: StepSignedIn,
		titleKey: "sys.welcome.step3Title",
		altKey: "sys.welcome.step3Alt",
		step: 3,
	},
] as const;

export default function LoginHero() {
	const { t } = useTranslation();
	const title = VITE_APP_TITLE || "BioPass";
	const prefersReducedMotion = useReducedMotion();
	const [active, setActive] = useState(0);
	const [shuffling, setShuffling] = useState(false);
	const [paused, setPaused] = useState(false);
	const skipShuffleComplete = useRef(false);

	const steps = STEP_META.map((step) => ({
		...step,
		title: t(step.titleKey),
		alt: t(step.altKey),
	}));

	const finishShuffle = useCallback(() => {
		if (skipShuffleComplete.current) return;
		skipShuffleComplete.current = true;
		setActive((index) => (index + 1) % STEP_META.length);
		setShuffling(false);
	}, []);

	useEffect(() => {
		if (shuffling) skipShuffleComplete.current = false;
	}, [shuffling]);

	useEffect(() => {
		if (prefersReducedMotion) {
			if (paused) return;
			const timer = window.setInterval(() => {
				setActive((index) => (index + 1) % STEP_META.length);
			}, HOLD_MS);
			return () => window.clearInterval(timer);
		}

		if (paused && !shuffling) return;
		if (shuffling) {
			const timer = window.setTimeout(finishShuffle, 900);
			return () => window.clearTimeout(timer);
		}

		const timer = window.setTimeout(() => setShuffling(true), HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [finishShuffle, paused, prefersReducedMotion, shuffling]);

	return (
		<div className="flex w-full max-w-md flex-col items-center px-10 text-center">
			<Logo size={56} />
			<div className="mt-5 text-4xl font-bold text-gray-800">{title}</div>
			<p className="mt-3 text-base text-gray-600">{t("sys.login.heroSubtitle")}</p>

			<div
				className="mt-8 w-full"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
				onFocus={() => setPaused(true)}
				onBlur={() => setPaused(false)}
			>
				<div className="relative w-full pb-9">
					<div className="invisible" aria-hidden>
						<ProcessCard step={1} title={steps[0].title} alt="" image={steps[0].image} />
					</div>

					{steps.map((step, index) => {
						const offset = (index - active + steps.length) % steps.length;
						const exitingFront = shuffling && offset === 0;
						const hidden = !exitingFront && offset > VISIBLE_BEHIND;
						const visualOffset = Math.min(offset, VISIBLE_BEHIND);

						return (
							<m.div
								key={step.titleKey}
								className="absolute inset-x-0 top-0"
								style={{
									transformOrigin: "50% 0%",
									zIndex: exitingFront ? steps.length + 2 : steps.length - offset,
								}}
								initial={false}
								animate={
									exitingFront
										? { x: 86, y: -36, rotate: 11, scale: 1.045, opacity: 1 }
										: {
												x: 0,
												y: visualOffset * STACK_OFFSET,
												rotate: 0,
												scale: hidden ? 0.88 : 1 - visualOffset * STACK_SCALE,
												opacity: hidden ? 0 : 1,
											}
								}
								transition={
									prefersReducedMotion
										? { duration: 0 }
										: {
												...(exitingFront ? SPRING_LIFT : SPRING_STACK),
												opacity: { duration: hidden ? 0.22 : 0.35, ease: "easeOut" },
												delay: exitingFront || hidden ? 0 : visualOffset * 0.055,
											}
								}
								onAnimationComplete={exitingFront ? finishShuffle : undefined}
								aria-hidden={offset !== 0}
							>
								<ProcessCard
									step={step.step}
									title={step.title}
									alt={step.alt}
									image={step.image}
									elevated={offset === 0 || exitingFront}
								/>
							</m.div>
						);
					})}
				</div>

				<p className="sr-only" aria-live="polite">
					{t("sys.welcome.stepLabel", { step: steps[active].step })}: {steps[active].title}
				</p>

				<div
					className="mt-2 flex items-center justify-center gap-2"
					role="tablist"
					aria-label={t("sys.login.heroBannerAria")}
				>
					{steps.map((step, index) => {
						const selected = index === active;
						return (
							<button
								key={step.titleKey}
								type="button"
								role="tab"
								aria-selected={selected}
								aria-label={step.title}
								className="group flex h-6 items-center justify-center px-0.5"
								onClick={() => {
									skipShuffleComplete.current = true;
									setShuffling(false);
									setActive(index);
								}}
							>
								<span
									className={`block h-2 rounded-full transition-all ${
										selected ? "w-5 bg-primary" : "w-2 bg-gray-400/70 group-hover:bg-gray-500"
									}`}
								/>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function ProcessCard({
	step,
	title,
	alt,
	image,
	elevated = false,
}: {
	step: number;
	title: string;
	alt: string;
	image: string;
	elevated?: boolean;
}) {
	return (
		<figure
			className={`overflow-hidden rounded-2xl border border-gray-300 bg-common-white text-left ${
				elevated ? "shadow-md" : "shadow-sm"
			}`}
		>
			<img src={image} alt={alt} className="aspect-[4/3] w-full object-cover" />
			<figcaption className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600">
				<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
					{step}
				</span>
				<span>{title}</span>
			</figcaption>
		</figure>
	);
}
