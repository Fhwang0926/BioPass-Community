import { Alert, Button, Checkbox, Col, Form, Input, Row } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import type { SignInReq } from "@/api/services/auth";
import { getHomePageNavigatePath } from "@/router/utils";
import { useSignIn } from "@/store/userStore";

function LoginForm() {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const signIn = useSignIn();

	const handleFinish = async ({ email, password }: SignInReq) => {
		setLoading(true);
		try {
			await signIn({ email, password });
			const path = getHomePageNavigatePath();
			if (window.location.hash !== path) {
				window.location.hash = path;
			}
			navigate(path, { replace: true });
		} catch {
			// signIn shows toast on failure
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<div className="mb-4 text-2xl font-bold xl:text-3xl">{t("sys.login.signInFormTitle")}</div>
			<Form
				name="login"
				size="large"
				initialValues={{
					remember: true,
				}}
				onFinish={handleFinish}
			>
				<div className="mb-4 flex flex-col">
					<Alert
						description={
							<div className="flex flex-col">
								<div className="flex">
									<span className="ml-1 text-text-secondary">
										{t("sys.login.emailVerificationRequired")}
									</span>
								</div>
							</div>
						}
						showIcon
					/>
				</div>

				<Form.Item name="email" rules={[{ required: true, message: t("sys.login.accountPlaceholder") }]}>
					<Input placeholder={t("sys.login.email")} />
				</Form.Item>
				<Form.Item name="password" rules={[{ required: true, message: t("sys.login.passwordPlaceholder") }]}>
					<Input.Password type="password" placeholder={t("sys.login.password")} />
				</Form.Item>
				<Form.Item>
					<Row align="middle" justify="space-between">
						<Col>
							<Form.Item name="remember" valuePropName="checked" noStyle hidden>
								<Checkbox defaultChecked>{t("sys.login.rememberMe")}</Checkbox>
							</Form.Item>
							<Link to="/welcome">
								<Button type="link" className="!underline" size="small">
									{t("sys.login.backToHome")}
								</Button>
							</Link>
						</Col>
					</Row>
				</Form.Item>
				<Form.Item>
					<Button type="primary" htmlType="submit" className="w-full" loading={loading}>
						{t("sys.login.loginButton")}
					</Button>
				</Form.Item>
			</Form>
		</>
	);
}

export default LoginForm;
