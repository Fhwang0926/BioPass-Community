import {
	AndroidFilled,
	ApiOutlined,
	AppleFilled,
	CloudServerOutlined,
	FileSearchOutlined,
	QrcodeOutlined,
} from "@ant-design/icons";
import { Button, QRCode, Typography } from "antd";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import authService from "@/api/services/auth";
import Overlay from "@/assets/images/background/overlay.jpg";
import StepApprove from "@/assets/images/welcome/welcome-step-approve.jpg";
import StepRequest from "@/assets/images/welcome/welcome-step-request.jpg";
import StepSignedIn from "@/assets/images/welcome/welcome-step-signedin.jpg";
import LocalePicker from "@/components/locale-picker";
import Logo from "@/components/logo";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/appStores";
import { themeVars } from "@/theme/theme.css";
import { rgbAlpha } from "@/utils/theme";

const { Title, Paragraph, Text } = Typography;
const { VITE_APP_TITLE } = import.meta.env;

export default function WelcomePage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const gradientBg = rgbAlpha(themeVars.colors.background.defaultChannel, 0.92);
	const bg = `linear-gradient(${gradientBg}, ${gradientBg}) center center / cover no-repeat,url(${Overlay})`;
	const title = VITE_APP_TITLE || "BioPass";

	const handleGetStarted = useCallback(async () => {
		try {
			const needs = await authService.getNeedsSetup();
			navigate(needs ? "/setup" : "/login");
		} catch {
			navigate("/login");
		}
	}, [navigate]);

	const steps = [
		{
			image: StepRequest,
			alt: t("sys.welcome.step1Alt"),
			title: t("sys.welcome.step1Title"),
			body: t("sys.welcome.step1Body"),
		},
		{
			image: StepApprove,
			alt: t("sys.welcome.step2Alt"),
			title: t("sys.welcome.step2Title"),
			body: t("sys.welcome.step2Body"),
		},
		{
			image: StepSignedIn,
			alt: t("sys.welcome.step3Alt"),
			title: t("sys.welcome.step3Title"),
			body: t("sys.welcome.step3Body"),
		},
	];

	const stores = [
		{
			platform: t("sys.welcome.platformIos"),
			icon: <AppleFilled />,
			url: APP_STORE_URL,
			cta: t("sys.welcome.appStore"),
			qrAlt: t("sys.welcome.qrIosAlt"),
		},
		{
			platform: t("sys.welcome.platformAndroid"),
			icon: <AndroidFilled />,
			url: PLAY_STORE_URL,
			cta: PLAY_STORE_URL ? t("sys.welcome.googlePlay") : t("sys.welcome.googlePlaySoon"),
			qrAlt: t("sys.welcome.qrAndroidAlt"),
		},
	];

	const features = [
		{
			icon: <CloudServerOutlined />,
			title: t("sys.welcome.feature1Title"),
			body: t("sys.welcome.feature1Body"),
		},
		{
			icon: <ApiOutlined />,
			title: t("sys.welcome.feature2Title"),
			body: t("sys.welcome.feature2Body"),
		},
		{
			icon: <FileSearchOutlined />,
			title: t("sys.welcome.feature3Title"),
			body: t("sys.welcome.feature3Body"),
		},
	];

	return (
		<div className="min-h-dvh bg-common-white">
			<header className="sticky top-0 z-20 border-b border-gray-300 bg-common-white/80 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
					<div className="flex items-center gap-2">
						<Logo size={32} />
						<span className="text-base font-semibold text-gray-800">{title}</span>
					</div>
					<div className="flex items-center gap-2">
						<LocalePicker variant="labeled" />
						<Link to="/login">
							<Button type="text">{t("sys.welcome.signIn")}</Button>
						</Link>
					</div>
				</div>
			</header>

			<section className="border-b border-gray-300" style={{ background: bg }}>
				<div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
					<span className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
						{t("sys.welcome.tagline")}
					</span>
					<Title level={1} className="!mb-4 !text-4xl sm:!text-5xl">
						{title}
					</Title>
					<Paragraph className="!mb-8 text-base text-gray-600 sm:text-lg">{t("sys.welcome.description")}</Paragraph>
					<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
						<Button type="primary" size="large" onClick={handleGetStarted}>
							{t("sys.welcome.getStarted")}
						</Button>
						<Link to="/login">
							<Button size="large" block>
								{t("sys.welcome.signIn")}
							</Button>
						</Link>
					</div>
					<Paragraph type="secondary" className="!mb-0 !mt-8 text-sm">
						{t("sys.welcome.audience")}
					</Paragraph>
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
				<div className="mx-auto mb-12 max-w-2xl text-center">
					<Title level={2} className="!mb-3">
						{t("sys.welcome.howItWorksTitle")}
					</Title>
					<Paragraph type="secondary" className="!mb-0">
						{t("sys.welcome.howItWorksSubtitle")}
					</Paragraph>
				</div>

				<ol className="grid list-none grid-cols-1 gap-10 p-0 md:grid-cols-3">
					{steps.map((step, index) => (
						<li key={step.title} className="flex flex-col">
							<div className="overflow-hidden rounded-2xl border border-gray-300 bg-gray-100 shadow-sm">
								<img src={step.image} alt={step.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
							</div>
							<div className="mt-5">
								<Text className="!text-xs !font-semibold uppercase !text-primary">
									{t("sys.welcome.stepLabel", { step: index + 1 })}
								</Text>
								<Title level={4} className="!mb-2 !mt-2">
									{step.title}
								</Title>
								<Paragraph type="secondary" className="!mb-0 text-sm">
									{step.body}
								</Paragraph>
							</div>
						</li>
					))}
				</ol>
			</section>

			<section className="border-y border-gray-300 bg-gray-100">
				<div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
					<Title level={2} className="!mb-10 text-center">
						{t("sys.welcome.featuresTitle")}
					</Title>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						{features.map((feature) => (
							<div key={feature.title} className="rounded-2xl border border-gray-300 bg-common-white p-6 shadow-sm">
								<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary">
									{feature.icon}
								</div>
								<Title level={5} className="!mb-2">
									{feature.title}
								</Title>
								<Paragraph type="secondary" className="!mb-0 text-sm">
									{feature.body}
								</Paragraph>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="border-t border-gray-300 bg-gray-100">
				<div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
					<Title level={2} className="!mb-3">
						{t("sys.welcome.getApp")}
					</Title>
					<Paragraph type="secondary" className="!mb-10">
						{t("sys.welcome.appDescription")}
					</Paragraph>

					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						{stores.map((store) => (
							<div
								key={store.platform}
								className="flex flex-col items-center rounded-2xl border border-gray-300 bg-common-white p-6 shadow-sm"
							>
								<div className="mb-5 flex items-center gap-2 text-gray-800">
									<span className="text-xl text-primary">{store.icon}</span>
									<span className="text-base font-semibold">{store.platform}</span>
								</div>

								{store.url ? (
									<a
										href={store.url}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={store.qrAlt}
										className="rounded-xl border border-gray-300 bg-common-white p-3 shadow-sm transition hover:border-primary/40"
									>
										<QRCode
											value={store.url}
											size={132}
											color="#1C252E"
											bgColor="#FFFFFF"
											bordered={false}
											errorLevel="M"
											aria-label={store.qrAlt}
										/>
									</a>
								) : (
									<div className="flex h-[156px] w-[156px] items-center justify-center rounded-xl border border-dashed border-gray-400 bg-gray-100">
										<QrcodeOutlined className="text-4xl text-gray-500" />
									</div>
								)}

								{store.url ? (
									<Button
										type="primary"
										size="large"
										block
										className="!mt-5"
										icon={store.icon}
										href={store.url}
										target="_blank"
										rel="noopener noreferrer"
									>
										{store.cta}
									</Button>
								) : (
									<Button size="large" block className="!mt-5" icon={store.icon} disabled>
										{store.cta}
									</Button>
								)}
							</div>
						))}
					</div>

					<Paragraph type="secondary" className="!mb-0 !mt-8 text-sm">
						{t("sys.welcome.scanHint")}
					</Paragraph>
				</div>
			</section>

			<footer className="border-t border-gray-300">
				<div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
					<Text type="secondary" className="text-sm">
						{title}
					</Text>
					<div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
						<Link to="/privacy" className="hover:underline">
							<Text type="secondary">{t("sys.welcome.privacy")}</Text>
						</Link>
						<Link to="/terms" className="hover:underline">
							<Text type="secondary">{t("sys.welcome.terms")}</Text>
						</Link>
						<a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
							<Text type="secondary">{t("sys.welcome.appStoreLink")}</Text>
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
