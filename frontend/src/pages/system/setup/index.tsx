import { Alert, Button, Card, Form, Input, Layout, Typography } from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import authService from "@/api/services/auth";
import { getHomePageNavigatePath } from "@/router/utils";
import { useUserActions, useUserToken } from "@/store/userStore";
import idleService from "@/api/services/idle";
import { hashClientPassword } from "@/utils/passwordHash";

const { Title, Paragraph, Text } = Typography;

type SetupFormValues = {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
	company_name?: string;
};

export default function SetupPage() {
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
			<Layout className="min-h-screen items-center justify-center bg-neutral-50">
				<Text type="secondary">Checking installation status…</Text>
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
			const payload =
				raw?.data != null && typeof raw.data === "object" && "accessToken" in raw.data
					? raw.data
					: raw;
			const { user, accessToken, refreshToken } = payload as {
				user: any;
				accessToken: string;
				refreshToken: string;
			};
			if (!accessToken) throw new Error("Setup response missing accessToken");
			setUserToken({ accessToken, refreshToken });
			setUserInfo(user ?? {});
			idleService.start(accessToken);
			toast.success("Administrator created. Welcome!");
			navigate(getHomePageNavigatePath(), { replace: true });
		} catch (err) {
			toast.error((err as Error).message || "Setup failed", { position: "top-center" });
		} finally {
			setLoading(false);
		}
	};

	return (
		<Layout className="min-h-screen bg-neutral-50">
			<div className="mx-auto flex w-full max-w-lg flex-col justify-center px-4 py-16">
				<div className="mb-8 text-center">
					<Title level={2} className="!mb-2">
						BioPass 초기 설정
					</Title>
					<Paragraph type="secondary" className="!mb-0">
						첫 설치입니다. 최고 관리자(조직 관리자) 계정을 만든 뒤 콘솔을 이용할 수 있습니다.
					</Paragraph>
				</div>

				<Card>
					<Alert
						type="info"
						showIcon
						className="mb-6"
						message="이 단계는 사용자 계정이 없을 때만 한 번 실행됩니다."
					/>
					<Form
						layout="vertical"
						size="large"
						requiredMark={false}
						onFinish={onFinish}
						initialValues={{ company_name: "" }}
					>
						<Form.Item
							label="이름"
							name="name"
							rules={[{ required: true, message: "이름을 입력하세요" }]}
						>
							<Input placeholder="Admin" autoComplete="name" />
						</Form.Item>
						<Form.Item
							label="이메일"
							name="email"
							rules={[
								{ required: true, message: "이메일을 입력하세요" },
								{ type: "email", message: "올바른 이메일을 입력하세요" },
							]}
						>
							<Input placeholder="admin@example.com" autoComplete="username" />
						</Form.Item>
						<Form.Item
							label="조직 이름 (선택)"
							name="company_name"
						>
							<Input placeholder="My Organization" autoComplete="organization" />
						</Form.Item>
						<Form.Item
							label="비밀번호"
							name="password"
							rules={[
								{ required: true, message: "비밀번호를 입력하세요" },
								{ min: 12, message: "비밀번호는 12자 이상이어야 합니다" },
								{
									pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
									message: "비밀번호는 영문과 숫자를 포함해야 합니다",
								},
							]}
						>
							<Input.Password placeholder="••••••••" autoComplete="new-password" />
						</Form.Item>
						<Form.Item
							label="비밀번호 확인"
							name="confirmPassword"
							dependencies={["password"]}
							rules={[
								{ required: true, message: "비밀번호를 다시 입력하세요" },
								({ getFieldValue }) => ({
									validator(_, value) {
										if (!value || getFieldValue("password") === value) {
											return Promise.resolve();
										}
										return Promise.reject(new Error("비밀번호가 일치하지 않습니다"));
									},
								}),
							]}
						>
							<Input.Password placeholder="••••••••" autoComplete="new-password" />
						</Form.Item>
						<Button type="primary" htmlType="submit" block loading={loading}>
							최고 관리자 생성 후 시작
						</Button>
					</Form>
				</Card>
			</div>
		</Layout>
	);
}
