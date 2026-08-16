import type { FormInstance } from "antd";
import {
	Alert,
	Button,
	Card,
	Col,
	Divider,
	Form,
	Input,
	Row,
	Space,
	Switch,
	Table,
	Tooltip,
} from "antd";
import { InfoCircleOutlined, LinkOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Iconify } from "@/components/icon";
import type { Application } from "@/api/services/application";
import { AuthFlowParamsCollapse } from "@/components/auth-flow/AuthFlowParamsCollapse";
import {
	buildAuthorizeUrl,
	buildCallbackExampleUrl,
	loginIdentifierToScope,
	normalizeApplicationFields,
} from "@/utils/bioPassApi";
import { AuthCredentialsSection } from "./AuthCredentialsSection";
import { useSampleLocale } from "@/pages/developer/components/useSampleLocale";

interface BasicInfoCardProps {
	form: FormInstance;
	application: Application;
	showSecret: boolean;
	newSecret: string | null;
	regenerating: boolean;
	onCopy: (text: string) => void;
	onRegenerateSecret: () => void;
}

export function BasicInfoCard({
	form,
	application,
	showSecret,
	newSecret,
	regenerating,
	onCopy,
	onRegenerateSecret,
}: BasicInfoCardProps) {
	const { t } = useTranslation();
	const sampleLocale = useSampleLocale();
	const ns = "sys.menu.application.detailPage";
	const watchedCallbackUrl = Form.useWatch("callback_url", form);
	const callbackExampleUrl = buildCallbackExampleUrl(watchedCallbackUrl ?? application.callbackUrl ?? (application as any).callback_url);

	return (
		<Card
			title={
				<Space>
					<Iconify icon="solar:lock-password-bold-duotone" size={24} style={{ color: "#1890ff" }} />
					<span style={{ fontSize: "16px", fontWeight: 600 }}>{t(`${ns}.basic_info`)}</span>
				</Space>
			}
			style={{
				borderRadius: "12px",
				boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
				marginBottom: "24px",
			}}
			styles={{ body: { padding: "24px" } }}
		>
			<Row gutter={[24, 24]}>
				<Col xs={24} sm={24} md={12}>
					<Form.Item
						label={
							<Space>
								<span style={{ fontWeight: 500 }}>{t(`${ns}.application_status`)}</span>
								<Tooltip title={t(`${ns}.application_status_tooltip`)}>
									<InfoCircleOutlined style={{ color: "#8c8c8c", fontSize: "14px" }} />
								</Tooltip>
							</Space>
						}
						name="is_active"
						valuePropName="checked"
						style={{ marginBottom: 0 }}
					>
						<Switch
							checkedChildren={
								<>
									<CheckCircleOutlined /> {t(`${ns}.active`)}
								</>
							}
							unCheckedChildren={t(`${ns}.inactive`)}
							size="default"
							style={{ marginTop: "4px" }}
						/>
					</Form.Item>
				</Col>
				<Col xs={24} sm={24} md={12}>
					<Form.Item
						label={
							<Space>
								<span style={{ fontWeight: 500 }}>{t(`${ns}.site_domain`)}</span>
								<Tooltip title={t(`${ns}.site_domain_tooltip`)}>
									<InfoCircleOutlined style={{ color: "#8c8c8c", fontSize: "14px" }} />
								</Tooltip>
							</Space>
						}
						name="name"
						rules={[
							{ required: true, message: t(`${ns}.site_domain_required`) },
							{
								validator: (_, value) => {
									if (!value) return Promise.resolve();
									const normalized = value.replace(/^https?:\/\//, "").replace(/\/$/, "");
									if (normalized === "localhost" || /^localhost:\d+$/.test(normalized)) {
										return Promise.resolve();
									}
									const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
									if (domainPattern.test(normalized)) return Promise.resolve();
									return Promise.reject(new Error(t(`${ns}.site_domain_invalid`)));
								},
							},
						]}
					>
						<Input placeholder="example.com" size="large" addonBefore="https://" style={{ borderRadius: "6px" }} />
					</Form.Item>
				</Col>

				<Col xs={24} sm={24} md={24}>
					<Form.Item
						label={
							<Space>
								<span style={{ fontWeight: 500 }}>{t(`${ns}.callback_url`)}</span>
							</Space>
						}
						name="callback_url"
						rules={[
							{ required: true, message: t(`${ns}.callback_url_required`) },
							{ type: "url", message: t(`${ns}.callback_url_invalid`) },
						]}
						style={{ marginBottom: "16px" }}
					>
						<Input placeholder="https://example.com/callback" size="large" style={{ borderRadius: "6px" }} />
					</Form.Item>
					<Form.Item label={t(`${ns}.test_url_title`)} style={{ marginBottom: 16 }}>
						<Space wrap>
							<Tooltip title={t(`${ns}.test_url_authorize_tooltip`)}>
								<Button
									type="default"
									icon={<LinkOutlined />}
									onClick={() => {
										const redirectUri = form.getFieldValue("callback_url");
										if (!redirectUri) {
											toast.error(t(`${ns}.test_url_fill_callback`));
											return;
										}
										const { clientId, loginIdentifier } = normalizeApplicationFields(application);
										if (!clientId) {
											toast.error(t(`${ns}.test_url_fill_callback`));
											return;
										}
										const email = prompt(t("sys.menu.application.detailPage.test_email_prompt"), "");
										if (!email?.trim()) {
											toast.error(t("sys.menu.application.detailPage.test_email_required"));
											return;
										}
										const url = buildAuthorizeUrl({
											clientId,
											redirectUri,
											scope: loginIdentifierToScope(loginIdentifier),
											email: email.trim(),
											lang: sampleLocale,
										});
										window.open(url, "_blank", "noopener,noreferrer");
									}}
								>
									{t(`${ns}.test_url_authorize_open`)}
								</Button>
							</Tooltip>
							<Tooltip title={t(`${ns}.test_url_callback_tooltip`)}>
								<Button
									type="default"
									icon={<LinkOutlined />}
									onClick={() => {
										const callbackUrl = form.getFieldValue("callback_url");
										if (!callbackUrl) {
											toast.error(t(`${ns}.test_url_fill_callback`));
											return;
										}
										window.open(callbackUrl, "_blank", "noopener,noreferrer");
									}}
								>
									{t(`${ns}.test_url_callback_open`)}
								</Button>
							</Tooltip>
						</Space>
					</Form.Item>
					<Alert
						message={
							<span style={{ fontWeight: 600, fontSize: "14px" }}>{t(`${ns}.callback_url_guide`)}</span>
						}
						description={
							<div style={{ marginTop: "12px" }}>
								<p style={{ marginBottom: "8px", lineHeight: "1.6", color: "#595959" }}>
									{t(`${ns}.callback_url_description`)}
								</p>
								<p style={{ marginBottom: "12px", fontSize: "13px", color: "#8c8c8c" }}>
									{t(`${ns}.callback_failure_note`)}
								</p>
								<div
									style={{
										background: "linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%)",
										padding: "16px",
										borderRadius: "8px",
										border: "1px solid #e8e8e8",
										marginTop: "12px",
									}}
								>
									<p style={{ marginBottom: "10px", fontWeight: 600, color: "#262626", fontSize: "14px" }}>
										{t(`${ns}.callback_parameters`)}
									</p>
									<Table
										size="small"
										columns={[
											{
												title: t(`${ns}.auth_flow_table_param`),
												dataIndex: "name",
												key: "name",
												width: 100,
												render: (v: string) => <code>{v}</code>,
											},
											{
												title: t(`${ns}.auth_flow_table_required`),
												dataIndex: "required",
												key: "required",
												width: 72,
												render: (v: boolean) =>
													t(v ? "sys.menu.application.detailPage.auth_flow_required_yes" : "sys.menu.application.detailPage.auth_flow_required_no"),
											},
											{ title: t(`${ns}.auth_flow_table_desc`), dataIndex: "desc", key: "desc" },
										]}
										dataSource={[
											{ key: "1", name: "code", required: true, desc: t(`${ns}.callback_param_code_desc`) },
											{ key: "2", name: "state", required: false, desc: t(`${ns}.callback_param_state_desc`) },
										]}
										pagination={false}
										style={{ marginBottom: "12px" }}
									/>
									<p style={{ marginBottom: "6px", fontSize: "13px", color: "#595959", fontWeight: 500 }}>
										{t(`${ns}.callback_next_step`)}
									</p>
									<div
										style={{
											marginTop: "12px",
											padding: "10px",
											background: "#fff",
											borderRadius: "4px",
											border: "1px solid #d9d9d9",
										}}
									>
										<p style={{ marginBottom: "4px", fontSize: "12px", color: "#8c8c8c", fontWeight: 500 }}>
											{t(`${ns}.callback_param_example`)}
										</p>
										<code
											style={{
												background: "#fafafa",
												padding: "6px 10px",
												borderRadius: "4px",
												fontSize: "13px",
												color: "#262626",
												display: "block",
												fontFamily: "monospace",
												border: "1px solid #f0f0f0",
											}}
										>
											{callbackExampleUrl}
										</code>
									</div>
								</div>
							</div>
						}
						type="info"
						showIcon
						style={{ marginTop: "0", borderRadius: "8px", border: "1px solid #d4edda", background: "#f6ffed" }}
						icon={<InfoCircleOutlined style={{ color: "#52c41a" }} />}
					/>
					<AuthFlowParamsCollapse />
				</Col>
			</Row>

			<Divider orientation="left" style={{ margin: "24px 0" }}>
				<Space>
					<Iconify icon="solar:key-bold-duotone" size={20} />
					<span>{t(`${ns}.auth_info`)}</span>
				</Space>
			</Divider>

			<AuthCredentialsSection
				application={application}
				showSecret={showSecret}
				newSecret={newSecret}
				regenerating={regenerating}
				onCopy={onCopy}
				onRegenerateSecret={onRegenerateSecret}
			/>
		</Card>
	);
}
