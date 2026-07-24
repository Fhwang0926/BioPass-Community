import { Button, Typography } from "antd";
import { Link, useNavigate } from "react-router";
import { useCallback } from "react";

import Overlay from "@/assets/images/background/overlay.jpg";
import authService from "@/api/services/auth";
import { themeVars } from "@/theme/theme.css";
import { rgbAlpha } from "@/utils/theme";

const { Title, Paragraph, Text } = Typography;
const { VITE_APP_TITLE } = import.meta.env;

export default function WelcomePage() {
	const navigate = useNavigate();
	const gradientBg = rgbAlpha(themeVars.colors.background.defaultChannel, 0.92);
	const bg = `linear-gradient(${gradientBg}, ${gradientBg}) center center / cover no-repeat,url(${Overlay})`;

	const handleGetStarted = useCallback(async () => {
		try {
			const status = await authService.getSetupStatus();
			const needs =
				Boolean((status as { needsSetup?: boolean })?.needsSetup) ||
				Boolean((status as { data?: { needsSetup?: boolean } })?.data?.needsSetup);
			navigate(needs ? "/setup" : "/login");
		} catch {
			navigate("/login");
		}
	}, [navigate]);

	return (
		<div
			className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
			style={{ background: bg }}
		>
			<div className="w-full max-w-xl text-center">
				<Title level={1} className="!mb-3">
					{VITE_APP_TITLE || "BioPass"}
				</Title>
				<Paragraph className="!mb-8 text-base text-gray-600">
					Self-hosted biometric MFA and OAuth platform. Deploy the API and admin console on your
					infrastructure, then complete initial setup to create your organization administrator.
				</Paragraph>
				<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Button type="primary" size="large" onClick={handleGetStarted}>
						Get started
					</Button>
					<Link to="/login">
						<Button size="large">Sign in</Button>
					</Link>
				</div>
				<div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
					<Link to="/privacy">
						<Text type="secondary">Privacy</Text>
					</Link>
					<Link to="/terms">
						<Text type="secondary">Terms</Text>
					</Link>
				</div>
			</div>
		</div>
	);
}
