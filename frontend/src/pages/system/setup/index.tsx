import { Alert, Button, Card, Form, Input, Layout, Typography } from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import authService from "@/api/services/auth";
import { getHomePageNavigatePath } from "@/router/utils";
import { useUserActions, useUserToken } from "@/store/userStore";
import idleService from "@/api/services/idle";
import { hashClientPassword } from "@/utils/passwordHash";
import LocalePicker from "@/components/locale-picker";
import { useTranslation } from "react-i18next";

const { Title, Paragraph, Text } = Typography;

type SetupFormValues = {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
	company_name?: string;
};

export default function SetupPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const token = useUserToken();
	const { setUserInfo, setUserToken } = useUserActions();
	const [loading, setLoading] = useState(false);
	const [checking, setChecking] = useState(true);
	const [needsSetup, setNeedsSetup] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const needs = await authService.getNeedsSetup();
				if (!cancelled) {
					setNeedsSetup(needs);
				}
			} catch {
				if (!cancelled) setNeedsSetup(false);
			} finally {
				if (!cancelled) setChecking(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (token?.accessToken) {
		return <Navigate to={getHomePageNavigatePath()} replace />;
	}

	if (checking) {
		return (
			<Layout className="relative min-h-screen items-center justify-center bg-gray-100">
				<div className="absolute right-6 top-6 z-10">
					<LocalePicker variant="labeled" />
				</div>
				<Text type="secondary">{t("sys.setup.checking")}</Text>
			</Layout>
		);
	}

	if (!needsSetup) {
		return <Navigate to="/login" replace />;
	}

	const onFinish = async (values: SetupFormValues) => {
		setLoading(true);
		try {
			const passwordHash = hashClientPassword(values.password);
			const res = await authService.completeSetup({
				name: values.name.trim(),
				email: values.email.trim().toLowerCase(),
				password: passwordHash,
				company_name: values.company_name?.trim() || undefined,
			});
			const raw = res as unknown as {
				user?: any;
				accessToken?: string;
				refreshToken?: string;
				data?: any;
			};
			const payload = raw?.data != null && typeof raw.data === "object" && "accessToken" in raw.data ? raw.data : raw;
			const { user, accessToken, refreshToken } = payload as {
				user: any;
				accessToken: string;
				refreshToken: string;
			};
			if (!accessToken) throw new Error(t("sys.setup.responseInvalid"));
			setUserToken({ accessToken, refreshToken });
			setUserInfo(user ?? {});
			idleService.start(accessToken);
			toast.success(t("sys.setup.success"));
			navigate(getHomePageNavigatePath(), { replace: true });
		} catch (err) {
			toast.error((err as Error).message || t("sys.setup.failed"), { position: "top-center" });
		} finally {
			setLoading(false);
		}
	};

	return (
		<Layout className="min-h-screen bg-gray-100">
			<div className="mx-auto flex w-full max-w-lg flex-col justify-center px-4 pb-16 pt-6">
				<div className="mb-8 flex justify-end">
					<LocalePicker variant="labeled" />
				</div>
				<div className="mb-8 text-center">
					<Title level={2} className="!mb-2">
						{t("sys.setup.title")}
					</Title>
					<Paragraph type="secondary" className="!mb-0">
						{t("sys.setup.subtitle")}
					</Paragraph>
				</div>

				<Card>
					<Alert type="info" showIcon className="mb-6" message={t("sys.setup.onceAlert")} />
					<Form
						layout="vertical"
						size="large"
						requiredMark={false}
						onFinish={onFinish}
						initialValues={{ company_name: "" }}
					>
						<Form.Item
							label={t("sys.setup.name")}
							name="name"
							rules={[{ required: true, message: t("sys.setup.validation.nameRequired") }]}
						>
							<Input placeholder={t("sys.setup.namePlaceholder")} autoComplete="name" />
						</Form.Item>
						<Form.Item
							label={t("sys.setup.email")}
							name="email"
							rules={[
								{ required: true, message: t("sys.setup.validation.emailRequired") },
								{ type: "email", message: t("sys.setup.validation.emailInvalid") },
							]}
						>
							<Input placeholder={t("sys.setup.emailPlaceholder")} autoComplete="username" />
						</Form.Item>
						<Form.Item label={t("sys.setup.companyOptional")} name="company_name">
							<Input placeholder={t("sys.setup.companyPlaceholder")} autoComplete="organization" />
						</Form.Item>
						<Form.Item
							label={t("sys.setup.password")}
							name="password"
							rules={[
								{ required: true, message: t("sys.setup.validation.passwordRequired") },
								{ min: 12, message: t("sys.setup.validation.passwordMin") },
								{
									pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
									message: t("sys.setup.validation.passwordPattern"),
								},
							]}
						>
							<Input.Password placeholder={t("sys.setup.passwordPlaceholder")} autoComplete="new-password" />
						</Form.Item>
						<Form.Item
							label={t("sys.setup.confirmPassword")}
							name="confirmPassword"
							dependencies={["password"]}
							rules={[
								{ required: true, message: t("sys.setup.validation.confirmRequired") },
								({ getFieldValue }) => ({
									validator(_, value) {
										if (!value || getFieldValue("password") === value) {
											return Promise.resolve();
										}
										return Promise.reject(new Error(t("sys.setup.validation.passwordMismatch")));
									},
								}),
							]}
						>
							<Input.Password placeholder={t("sys.setup.passwordPlaceholder")} autoComplete="new-password" />
						</Form.Item>
						<Button type="primary" htmlType="submit" block loading={loading}>
							{t("sys.setup.submit")}
						</Button>
					</Form>
				</Card>
			</div>
		</Layout>
	);
}
