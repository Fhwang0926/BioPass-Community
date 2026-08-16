import { Layout } from "antd";
import { Navigate } from "react-router";
import { useEffect, useState } from "react";

import Overlay from "@/assets/images/background/overlay.jpg";
import LocalePicker from "@/components/locale-picker";
import authService from "@/api/services/auth";
import { getHomePageNavigatePath } from "@/router/utils";
import { useUserToken } from "@/store/userStore";

import SettingButton from "@/layouts/components/setting-button";
import { themeVars } from "@/theme/theme.css";
import { rgbAlpha } from "@/utils/theme";
import LoginForm from "./LoginForm";

const { VITE_APP_TITLE } = import.meta.env;

function Login() {
	const token = useUserToken();
	const [checkingSetup, setCheckingSetup] = useState(true);
	const [needsSetup, setNeedsSetup] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const needs = await authService.getNeedsSetup();
				if (!cancelled) setNeedsSetup(needs);
			} catch {
				if (!cancelled) setNeedsSetup(false);
			} finally {
				if (!cancelled) setCheckingSetup(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const gradientBg = rgbAlpha(themeVars.colors.background.defaultChannel, 0.9);
	const bg = `linear-gradient(${gradientBg}, ${gradientBg}) center center / cover no-repeat,url(${Overlay})`;

	if (token?.accessToken) {
		return <Navigate to={getHomePageNavigatePath()} replace />;
	}

	if (checkingSetup) {
		return null;
	}

	if (needsSetup) {
		return <Navigate to="/setup" replace />;
	}

	return (
		<Layout className="relative flex !min-h-screen !w-full !flex-row">
			<div
				className="hidden grow flex-col items-center justify-center bg-center bg-no-repeat px-8 md:flex"
				style={{ background: bg }}
			>
				<div className="max-w-lg text-center">
					<div className="mb-4 text-4xl font-bold text-gray-900 xl:text-5xl">
						{VITE_APP_TITLE || "BioPass"}
					</div>
					<p className="text-base text-gray-600 xl:text-lg">
						Self-hosted biometric MFA console. Sign in with your administrator account.
					</p>
				</div>
			</div>

			<div className="m-auto flex !h-screen w-full max-w-[480px] flex-col justify-center px-[16px] lg:px-[64px]">
				<LoginForm />
			</div>

			<div className="absolute right-2 top-0 flex flex-row">
				<LocalePicker />
				<SettingButton />
			</div>
		</Layout>
	);
}

export default Login;
