import { AppleOutlined, AndroidOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import { Link, useNavigate } from "react-router";
import { useCallback } from "react";

import Overlay from "@/assets/images/background/overlay.jpg";
import Logo from "@/components/logo";
import authService from "@/api/services/auth";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/appStores";
import { themeVars } from "@/theme/theme.css";
import { rgbAlpha } from "@/utils/theme";
import LocalePicker from "@/components/locale-picker";
import { useTranslation } from "react-i18next";

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

	return (
		<div
			className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12"
			style={{ background: bg }}
		>
			<div className="absolute right-2 top-0">
				<LocalePicker />
			</div>
			<div className="w-full max-w-xl text-center">
				<div className="mb-6 flex justify-center">
					<Logo size={72} />
				</div>
				<Title level={1} className="!mb-3">
					{title}
				</Title>
				<Paragraph className="!mb-3 text-base text-gray-600">{t("sys.welcome.description")}</Paragraph>
				<Paragraph type="secondary" className="!mb-8 text-sm">
					{t("sys.welcome.audience")}
				</Paragraph>
				<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Button type="primary" size="large" onClick={handleGetStarted}>
						{t("sys.welcome.getStarted")}
					</Button>
					<Link to="/login">
						<Button size="large">{t("sys.welcome.signIn")}</Button>
					</Link>
				</div>

				<div className="mt-10 rounded-xl border border-black/5 bg-white/70 px-5 py-5 text-left shadow-sm backdrop-blur-sm">
					<Text strong className="!mb-1 block">
						{t("sys.welcome.getApp")}
					</Text>
					<Paragraph type="secondary" className="!mb-4 !mt-1 text-sm">
						{t("sys.welcome.appDescription")}
					</Paragraph>
					<Space wrap size="middle">
						<Button
							type="default"
							size="large"
							icon={<AppleOutlined />}
							href={APP_STORE_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							{t("sys.welcome.appStore")}
						</Button>
						{PLAY_STORE_URL ? (
							<Button
								type="default"
								size="large"
								icon={<AndroidOutlined />}
								href={PLAY_STORE_URL}
								target="_blank"
								rel="noopener noreferrer"
							>
								{t("sys.welcome.googlePlay")}
							</Button>
						) : (
							<Button type="default" size="large" icon={<AndroidOutlined />} disabled>
								{t("sys.welcome.googlePlaySoon")}
							</Button>
						)}
					</Space>
				</div>

				<div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
					<Link to="/privacy">
						<Text type="secondary">{t("sys.welcome.privacy")}</Text>
					</Link>
					<Link to="/terms">
						<Text type="secondary">{t("sys.welcome.terms")}</Text>
					</Link>
					<a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
						<Text type="secondary">{t("sys.welcome.appStoreLink")}</Text>
					</a>
				</div>
			</div>
		</div>
	);
}
