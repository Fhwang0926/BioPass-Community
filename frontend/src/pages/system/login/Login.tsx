import { Alert, Button, Layout, Result, Spin } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router";

import authService from "@/api/services/auth";
import Overlay from "@/assets/images/background/overlay.jpg";
import LocalePicker from "@/components/locale-picker";
import { getHomePageNavigatePath } from "@/router/utils";
import { useUserToken } from "@/store/userStore";

import SettingButton from "@/layouts/components/setting-button";
import { themeVars } from "@/theme/theme.css";
import { rgbAlpha } from "@/utils/theme";
import LoginForm from "./LoginForm";
import LoginHero from "./LoginHero";

/** Outcome of the first-run setup probe; `unreachable` keeps the two apart. */
type SetupState = "checking" | "required" | "done" | "unreachable";

/** Leaves the notice on screen long enough to read before continuing to setup. */
function SetupRedirect() {
	const navigate = useNavigate();

	useEffect(() => {
		const timer = window.setTimeout(() => navigate("/setup", { replace: true }), 2000);
		return () => window.clearTimeout(timer);
	}, [navigate]);

	return null;
}

function Login() {
	const { t } = useTranslation();
	const token = useUserToken();
	const [setupState, setSetupState] = useState<SetupState>("checking");

	const checkSetup = useCallback(async (signal?: { cancelled: boolean }, options?: { keepUi?: boolean }) => {
		// Background retries keep the current screen so it does not flicker.
		if (!options?.keepUi) setSetupState("checking");
		try {
			const needs = await authService.getNeedsSetup();
			if (!signal?.cancelled) setSetupState(needs ? "required" : "done");
		} catch {
			// A failed probe is not the same as "setup is complete": showing the
			// sign-in form here would only fail again on submit.
			if (!signal?.cancelled) setSetupState("unreachable");
		}
	}, []);

	useEffect(() => {
		const signal = { cancelled: false };
		void checkSetup(signal);
		return () => {
			signal.cancelled = true;
		};
	}, [checkSetup]);

	// The API often comes up after the console (dev restarts, container boots),
	// so recover on its own instead of stranding the user on the error screen.
	useEffect(() => {
		if (setupState !== "unreachable") return;
		const signal = { cancelled: false };
		const timer = window.setInterval(() => void checkSetup(signal, { keepUi: true }), 5000);
		return () => {
			signal.cancelled = true;
			window.clearInterval(timer);
		};
	}, [setupState, checkSetup]);

	const gradientBg = rgbAlpha(themeVars.colors.background.defaultChannel, 0.9);
	const bg = `linear-gradient(${gradientBg}, ${gradientBg}) center center / cover no-repeat,url(${Overlay})`;

	if (token?.accessToken) {
		return <Navigate to={getHomePageNavigatePath()} replace />;
	}

	if (setupState === "checking") {
		return (
			<Layout className="relative min-h-screen items-center justify-center">
				<div className="absolute right-6 top-6 z-10">
					<LocalePicker variant="labeled" />
				</div>
				<Spin size="large" tip={t("sys.setup.checking")}>
					<div className="h-16 w-48" />
				</Spin>
			</Layout>
		);
	}

	if (setupState === "required") {
		return (
			<Layout className="relative min-h-screen items-center justify-center px-4">
				<div className="absolute right-6 top-6 z-10">
					<LocalePicker variant="labeled" />
				</div>
				<Result
					status="info"
					title={t("sys.login.setupRequiredTitle")}
					subTitle={t("sys.login.setupRequiredBody")}
					extra={
						<Link to="/setup" replace>
							<Button type="primary" size="large">
								{t("sys.login.setupRequiredCta")}
							</Button>
						</Link>
					}
				/>
				<SetupRedirect />
			</Layout>
		);
	}

	if (setupState === "unreachable") {
		return (
			<Layout className="relative min-h-screen items-center justify-center px-4">
				<div className="absolute right-6 top-6 z-10">
					<LocalePicker variant="labeled" />
				</div>
				<Alert
					type="error"
					showIcon
					className="max-w-xl"
					message={t("sys.login.serverUnreachableTitle")}
					description={
						<>
							<div>{t("sys.login.serverUnreachableBody")}</div>
							<div className="mt-2 text-xs text-gray-500">{t("sys.login.retryingHint")}</div>
						</>
					}
					action={
						<Button size="small" onClick={() => void checkSetup()}>
							{t("sys.login.retry")}
						</Button>
					}
				/>
			</Layout>
		);
	}

	return (
		<Layout className="relative flex !min-h-screen !w-full !flex-row">
			<div
				className="hidden !h-screen grow flex-col items-center justify-center bg-center bg-no-repeat md:flex"
				style={{ background: bg }}
			>
				<LoginHero />
			</div>

			<div className="m-auto flex !h-screen w-full max-w-[480px] flex-col justify-center px-[16px] lg:px-[64px]">
				<LoginForm />
			</div>

			<div className="absolute right-6 top-6 z-10 flex flex-row items-center gap-2">
				<LocalePicker variant="labeled" />
				<SettingButton />
			</div>
		</Layout>
	);
}

export default Login;
