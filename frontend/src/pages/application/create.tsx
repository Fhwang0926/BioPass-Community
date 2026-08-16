import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
	Button,
	Card,
	Col,
	Collapse,
	Form,
	Input,
	InputNumber,
	Row,
	Select,
	Space,
	Switch,
	Alert,
	Table,
} from "antd";
import type { FormProps } from "antd";
import { useState } from "react";
import { toast } from "sonner";
import { CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";
import applicationService from "@/api/services/application";
import { buildCallbackExampleUrl } from "@/utils/bioPassApi";

export default function ApplicationCreatePage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [form] = Form.useForm();
	const [createdApp, setCreatedApp] = useState<any>(null);
	const [submitting, setSubmitting] = useState(false);
	const watchedCallbackUrl = Form.useWatch("callback_url", form);
	const callbackExampleUrl = buildCallbackExampleUrl(watchedCallbackUrl);

	// 도메인 정규화 함수 (프로토콜 제거)
	const normalizeDomain = (domain: string): string => {
		if (!domain) return domain;
		// http:// 또는 https:// 제거
		return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
	};

	const handleSubmit = async (values: any) => {
		setSubmitting(true);
		try {
			// 도메인 정규화
			const normalizedValues = {
				...values,
				name: normalizeDomain(values.name),
			};
			const response = await applicationService.createApplication(normalizedValues);
			// apiClient 인터셉터가 result/data 한 depth 풀어서 반환 → response는 생성된 앱 객체
			if (response && (response as { id?: number }).id) {
				setCreatedApp(response);
				toast.success(t("sys.menu.application.create_success"));
				await queryClient.invalidateQueries({
					queryKey: ["application"],
					refetchType: "active",
				});
			}
		} catch (error) {
			toast.error(t("sys.menu.application.create_error"));
		} finally {
			setSubmitting(false);
		}
	};

	const handleFinishFailed: FormProps["onFinishFailed"] = (errorInfo) => {
		toast.error(t("sys.menu.application.validation_error"));
		const first = errorInfo?.errorFields?.[0];
		if (first?.name?.length) {
			form.scrollToField(first.name, { behavior: "smooth", block: "center" });
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success(t("common.copied"));
	};

	if (createdApp) {
		return (
			<Space direction="vertical" size="large" className="w-full">
				<Card>
					<Alert
						message={t("sys.menu.application.create_success")}
						description={
							<Space direction="vertical" className="w-full mt-4">
								<div>
									<strong>Client ID:</strong>{" "}
									<code className="bg-gray-100 px-2 py-1 rounded">{createdApp.clientId}</code>
									<Button
										type="text"
										icon={<CopyOutlined />}
										onClick={() => copyToClipboard(createdApp.clientId)}
									>
										{t("common.copy")}
									</Button>
								</div>
								<div>
									<strong>Client Secret:</strong>{" "}
									<Alert
										message={t("sys.menu.application.secret_once")}
										description={
											<Space>
												<code className="bg-yellow-100 px-2 py-1 rounded">
													{createdApp.clientSecret}
												</code>
												<Button
													type="text"
													icon={<CopyOutlined />}
													onClick={() => copyToClipboard(createdApp.clientSecret)}
												>
													{t("common.copy")}
												</Button>
											</Space>
										}
										type="warning"
										showIcon
										className="mt-2"
									/>
								</div>
							</Space>
						}
						type="success"
						showIcon
					/>
				</Card>
				<Card>
					<Space>
						<Button type="primary" onClick={() => navigate(`/service/application/${createdApp.id}`)}>
							{t("sys.menu.application.go_detail")}
						</Button>
						<Button onClick={() => navigate("/service/application")}>
							{t("sys.menu.application.detailPage.back_to_list")}
						</Button>
					</Space>
				</Card>
			</Space>
		);
	}

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Space>
					<Button onClick={() => navigate("/service/application")}>
						<Iconify icon="solar:arrow-left-bold" size={18} className="mr-2" />
						{t("sys.menu.application.detailPage.back_to_list")}
					</Button>
				</Space>
			</Card>

			<Form
				form={form}
				layout="vertical"
				onFinish={handleSubmit}
				onFinishFailed={handleFinishFailed}
					initialValues={{
						login_identifier: "both",
						auth_request_expiry: 180,
						duplicate_request_limit: 2,
						is_active: true,
					}}
			>
				{/* 기본 정보 */}
				<Card
					title={
						<Space>
							<Iconify icon="solar:lock-password-bold-duotone" size={24} />
							<span>{t("sys.menu.application.detailPage.basic_info")}</span>
						</Space>
					}
				>
					<Row gutter={16}>
						<Col span={24}>
							<Form.Item
								label={t("sys.menu.application.detailPage.site_domain")}
								name="name"
								rules={[
									{ required: true, message: t("sys.menu.application.detailPage.site_domain_required") },
									{
										validator: (_, value) => {
											if (!value) return Promise.resolve();
											const normalized = value.replace(/^https?:\/\//, '').replace(/\/$/, '');
											// localhost 허용 (개발용)
											if (normalized === 'localhost' || /^localhost:\d+$/.test(normalized)) {
												return Promise.resolve();
											}
											const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
											if (domainPattern.test(normalized)) {
												return Promise.resolve();
											}
											return Promise.reject(new Error(t("sys.menu.application.detailPage.site_domain_invalid")));
										}
									}
								]}
								tooltip={t("sys.menu.application.detailPage.site_domain_tooltip")}
							>
								<Input 
									placeholder="example.com"
									addonBefore="https://"
								/>
							</Form.Item>
						</Col>
						<Col span={24}>
							<Form.Item 
								label={t("sys.menu.application.detailPage.callback_url")}
								name="callback_url"
								rules={[
									{ required: true, message: t("sys.menu.application.detailPage.callback_url_required") },
									{
										type: "url",
										message: t("sys.menu.application.detailPage.callback_url_invalid")
									}
								]}
							>
								<Input placeholder="https://example.com/callback" />
							</Form.Item>
							<Alert
								message={t("sys.menu.application.detailPage.callback_url_guide")}
								description={
									<div style={{ marginTop: '8px' }}>
										<p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#595959' }}>
											{t("sys.menu.application.detailPage.callback_url_description")}
										</p>
										<p style={{ marginBottom: '12px', fontSize: '13px', color: '#8c8c8c' }}>
											{t("sys.menu.application.detailPage.callback_failure_note")}
										</p>
										<div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', marginTop: '8px' }}>
											<p style={{ marginBottom: '10px', fontWeight: 600, fontSize: '14px' }}>
												{t("sys.menu.application.detailPage.callback_parameters")}
											</p>
											<Table
												size="small"
												columns={[
													{ title: t("sys.menu.application.detailPage.auth_flow_table_param"), dataIndex: 'name', key: 'name', width: 100, render: (v: string) => <code>{v}</code> },
													{ title: t("sys.menu.application.detailPage.auth_flow_table_required"), dataIndex: 'required', key: 'required', width: 72, render: (v: boolean) => t(v ? "sys.menu.application.detailPage.auth_flow_required_yes" : "sys.menu.application.detailPage.auth_flow_required_no") },
													{ title: t("sys.menu.application.detailPage.auth_flow_table_desc"), dataIndex: 'desc', key: 'desc' },
												]}
												dataSource={[
													{ key: '1', name: 'code', required: true, desc: t("sys.menu.application.detailPage.callback_param_code_desc") },
													{ key: '2', name: 'state', required: false, desc: t("sys.menu.application.detailPage.callback_param_state_desc") },
												]}
												pagination={false}
												style={{ marginBottom: '12px' }}
											/>
											<p style={{ marginBottom: '6px', fontSize: '13px', color: '#595959', fontWeight: 500 }}>
												{t("sys.menu.application.detailPage.callback_next_step")}
											</p>
											<p style={{ marginTop: '8px', marginBottom: 0, fontSize: '13px', color: '#595959' }}>
												<strong>{t("sys.menu.application.detailPage.callback_param_example")}</strong>{' '}
												<code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '2px' }}>{callbackExampleUrl}</code>
											</p>
										</div>
									</div>
								}
								type="info"
								showIcon
								style={{ marginTop: '8px', marginBottom: '16px' }}
							/>
							<Collapse
								style={{ marginTop: '12px' }}
								items={[
									{
										key: '1',
										label: <span style={{ fontWeight: 600 }}>{t("sys.menu.application.detailPage.auth_flow_params_title")}</span>,
										children: (() => {
											const ns = "sys.menu.application.detailPage";
											const req = (v: boolean) => t(v ? `${ns}.auth_flow_required_yes` : `${ns}.auth_flow_required_no`);
											const cols = [
												{ title: t(`${ns}.auth_flow_table_param`), dataIndex: 'name', key: 'name', width: 140, render: (v: string) => <code>{v}</code> },
												{ title: t(`${ns}.auth_flow_table_required`), dataIndex: 'required', key: 'required', width: 72, render: (v: boolean) => req(v) },
												{ title: t(`${ns}.auth_flow_table_desc`), dataIndex: 'desc', key: 'desc' },
											];
											const authorizeData = [
												{ key: '1', name: 'client_id', required: true, desc: t(`${ns}.auth_flow_param_client_id`) },
												{ key: '2', name: 'redirect_uri', required: true, desc: t(`${ns}.auth_flow_param_redirect_uri`) },
												{ key: '3', name: 'response_type', required: true, desc: t(`${ns}.auth_flow_param_response_type`) },
												{ key: '4', name: 'scope', required: false, desc: t(`${ns}.auth_flow_param_scope`) },
												{ key: '5', name: 'state', required: false, desc: t(`${ns}.auth_flow_param_state`) },
												{ key: '6', name: 'email', required: false, desc: t(`${ns}.auth_flow_param_email`) },
												{ key: '7', name: 'phone', required: false, desc: t(`${ns}.auth_flow_param_phone`) },
												{ key: '8', name: 'phone_origin', required: false, desc: t(`${ns}.auth_flow_param_phone_origin`) },
											];
											const verifyGetData = [
												{ key: '1', name: 'request_id', required: true, desc: t(`${ns}.auth_flow_param_request_id`) },
												{ key: '2', name: 'email', required: true, desc: t(`${ns}.auth_flow_param_email_verify`) },
												{ key: '3', name: 'redirect_uri', required: true, desc: t(`${ns}.auth_flow_param_redirect_uri_verify`) },
												{ key: '4', name: 'state', required: false, desc: t(`${ns}.auth_flow_param_state_verify`) },
												{ key: '5', name: 'app_name', required: false, desc: t(`${ns}.auth_flow_param_app_name`) },
											];
											const verifyPostData = [
												{ key: '1', name: 'request_id', required: true, desc: t(`${ns}.auth_flow_param_request_id`) },
												{ key: '2', name: 'email', required: true, desc: t(`${ns}.auth_flow_param_email_verify`) },
												{ key: '3', name: 'code', required: true, desc: t(`${ns}.auth_flow_param_code_6`) },
												{ key: '4', name: 'redirect_uri', required: true, desc: t(`${ns}.auth_flow_param_redirect_uri_state_note`) },
												{ key: '5', name: 'state', required: false, desc: t(`${ns}.auth_flow_param_redirect_uri_state_note`) },
											];
											const callbackData = [
												{ key: '1', name: 'code', required: true, desc: t(`${ns}.auth_flow_param_code_callback`) },
												{ key: '2', name: 'state', required: false, desc: t(`${ns}.auth_flow_param_state_callback`) },
											];
											const tokenData = [
												{ key: '1', name: 'grant_type', required: true, desc: t(`${ns}.auth_flow_param_grant_type`) },
												{ key: '2', name: 'code', required: true, desc: t(`${ns}.auth_flow_param_code_token`) },
												{ key: '3', name: 'client_id', required: true, desc: t(`${ns}.auth_flow_param_client_id_token`) },
												{ key: '4', name: 'client_secret', required: true, desc: t(`${ns}.auth_flow_param_client_secret`) },
												{ key: '5', name: 'code_verifier', required: false, desc: t(`${ns}.auth_flow_param_code_verifier`) },
												{ key: '6', name: 'redirect_uri', required: false, desc: t(`${ns}.auth_flow_param_redirect_uri_token`) },
											];
											const tokenResData = [
												{ key: '1', name: 'access_token', required: false, desc: t(`${ns}.auth_flow_param_access_token`) },
												{ key: '2', name: 'token_type', required: false, desc: t(`${ns}.auth_flow_param_token_type`) },
												{ key: '3', name: 'expires_in', required: false, desc: t(`${ns}.auth_flow_param_expires_in`) },
												{ key: '4', name: 'refresh_token', required: false, desc: t(`${ns}.auth_flow_param_refresh_token`) },
												{ key: '5', name: 'scope', required: false, desc: t(`${ns}.auth_flow_param_scope_res`) },
											];
											return (
												<div style={{ padding: '4px 0' }}>
													<p style={{ marginBottom: '12px', color: '#595959' }}>{t(`${ns}.auth_flow_params_intro`)}</p>
													<p style={{ fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t(`${ns}.auth_flow_authorize`)}</p>
													<Table size="small" columns={cols} dataSource={authorizeData} pagination={false} style={{ marginBottom: '16px' }} />
													<p style={{ fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t(`${ns}.auth_flow_verify_email_get`)}</p>
													<Table size="small" columns={cols} dataSource={verifyGetData} pagination={false} style={{ marginBottom: '16px' }} />
													<p style={{ fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t(`${ns}.auth_flow_verify_email_post`)}</p>
													<Table size="small" columns={cols} dataSource={verifyPostData} pagination={false} style={{ marginBottom: '16px' }} />
													<p style={{ fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t(`${ns}.auth_flow_callback_redirect`)}</p>
													<Table size="small" columns={cols} dataSource={callbackData} pagination={false} style={{ marginBottom: '16px' }} />
													<p style={{ fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t(`${ns}.auth_flow_token_post`)}</p>
													<Table size="small" columns={cols} dataSource={tokenData} pagination={false} style={{ marginBottom: '16px' }} />
													<p style={{ fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t(`${ns}.auth_flow_token_response`)}</p>
													<Table size="small" columns={cols} dataSource={tokenResData} pagination={false} />
												</div>
											);
										})(),
									},
								]}
							/>
						</Col>
						<Col span={24}>
							<Form.Item
								label={t("common.statusText")}
								name="is_active"
								valuePropName="checked"
							>
								<Switch checkedChildren={t("common.active")} unCheckedChildren={t("common.inactive")} />
							</Form.Item>
						</Col>
					</Row>
				</Card>

				{/* 인증 설정 */}
				<Card
					title={
						<Space>
							<Iconify icon="solar:key-bold-duotone" size={24} />
							<span>{t("sys.menu.application.detailPage.auth_settings")}</span>
						</Space>
					}
				>
					<Row gutter={16}>
						<Col span={24}>
							<Form.Item
								label={t("sys.menu.application.detailPage.login_identifier")}
								name="login_identifier"
								rules={[{ required: true }]}
							>
								<Select>
									<Select.Option value="email">{t("sys.menu.application.detailPage.login_identifier_email")}</Select.Option>
									<Select.Option value="phone">{t("sys.menu.application.detailPage.login_identifier_phone")}</Select.Option>
									<Select.Option value="both">{t("sys.menu.application.detailPage.login_identifier_both")}</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24}>
							<Form.Item
								label={t("sys.menu.application.detailPage.auth_request_expiry")}
								name="auth_request_expiry"
								rules={[{ required: true }]}
							>
								<InputNumber min={1} style={{ width: "100%" }} />
							</Form.Item>
						</Col>
						<Col span={24}>
							<Form.Item
								label={t("sys.menu.application.detailPage.duplicate_request_limit")}
								name="duplicate_request_limit"
								tooltip={t("sys.menu.application.detailPage.duplicate_request_limit_tooltip")}
							>
								<InputNumber min={0} style={{ width: "100%" }} />
							</Form.Item>
						</Col>
					</Row>
				</Card>

				<Card>
					<Space>
						<Button
							type="primary"
							loading={submitting}
							onClick={() => form.submit()}
						>
							{t("common.create")}
						</Button>
						<Button onClick={() => navigate("/service/application")} disabled={submitting}>
							{t("common.cancelText")}
						</Button>
					</Space>
				</Card>
			</Form>
		</Space>
	);
}
