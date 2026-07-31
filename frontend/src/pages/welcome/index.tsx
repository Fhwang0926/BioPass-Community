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

const { Title, Paragraph, Text } = Typography;
const { VITE_APP_TITLE } = import.meta.env;

export default function WelcomePage() {
	const navigate = useNavigate();
	const gradientBg = rgbAlpha(themeVars.colors.background.defaultChannel, 0.92);
	const bg = `linear-gradient(${gradientBg}, ${gradientBg}) center center / cover no-repeat,url(${Overlay})`;
	const title = VITE_APP_TITLE || "BioPass";

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
				<div className="mb-6 flex justify-center">
					<Logo size={72} />
				</div>
				<Title level={1} className="!mb-3">
					{title}
				</Title>
				<Paragraph className="!mb-3 text-base text-gray-600">
					Self-hosted biometric MFA and OAuth for your apps. Run the API and admin console on your
					own infrastructure, then approve sign-ins from the Bio Pass mobile app with fingerprint or
					Face ID.
				</Paragraph>
				<Paragraph type="secondary" className="!mb-8 text-sm">
					Operators: complete first-run setup, register an OAuth application, and point clients at
					this server. End users: install Bio Pass, sign in with email, and approve login requests
					when prompted.
				</Paragraph>
				<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Button type="primary" size="large" onClick={handleGetStarted}>
						Get started
					</Button>
					<Link to="/login">
						<Button size="large">Sign in</Button>
					</Link>
				</div>

				<div className="mt-10 rounded-xl border border-black/5 bg-white/70 px-5 py-5 text-left shadow-sm backdrop-blur-sm">
					<Text strong className="!mb-1 block">
						Get the Bio Pass app
					</Text>
					<Paragraph type="secondary" className="!mb-4 !mt-1 text-sm">
						Receive push login requests and approve or deny them with biometrics. Available on the
						App Store today.
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
							Download on the App Store
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
								Get it on Google Play
							</Button>
						) : (
							<Button type="default" size="large" icon={<AndroidOutlined />} disabled>
								Google Play (coming soon)
							</Button>
						)}
					</Space>
				</div>

				<div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
					<Link to="/privacy">
						<Text type="secondary">Privacy</Text>
					</Link>
					<Link to="/terms">
						<Text type="secondary">Terms</Text>
					</Link>
					<a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
						<Text type="secondary">App Store</Text>
					</a>
				</div>
			</div>
		</div>
	);
}
