import { Card, Col, Form, InputNumber, Row, Select, Space, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";

export function AuthSettingsCard() {
	const { t } = useTranslation();
	const ns = "sys.menu.application.detailPage";

	return (
		<Card
			title={
				<Space>
					<Iconify icon="solar:key-bold-duotone" size={24} style={{ color: "#52c41a" }} />
					<span style={{ fontSize: "16px", fontWeight: 600 }}>{t(`${ns}.auth_settings`)}</span>
				</Space>
			}
			style={{
				borderRadius: "12px",
				boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
				marginBottom: "24px",
			}}
			styles={{ body: { padding: "24px" } }}
		>
			<p style={{ marginBottom: "24px", color: "rgba(0,0,0,0.45)" }}>{t(`${ns}.auth_settings_desc`)}</p>
			<Row gutter={[16, 16]}>
				<Col xs={24} sm={24} md={8}>
					<Form.Item
						label={
							<Space>
								<span>{t(`${ns}.login_identifier`)}</span>
								<Tooltip title={t(`${ns}.login_identifier_tooltip`)}>
									<InfoCircleOutlined style={{ color: "#8c8c8c" }} />
								</Tooltip>
							</Space>
						}
						name="login_identifier"
						rules={[{ required: true, message: t(`${ns}.login_identifier_required`) }]}
					>
						<Select size="large">
							<Select.Option value="email">
								<Space>
									<Iconify icon="solar:letter-bold-duotone" size={16} />
									{t(`${ns}.login_identifier_email`)}
								</Space>
							</Select.Option>
							<Select.Option value="phone">
								<Space>
									<Iconify icon="solar:phone-bold-duotone" size={16} />
									{t(`${ns}.login_identifier_phone`)}
								</Space>
							</Select.Option>
							<Select.Option value="both">
								<Space>
									<Iconify icon="solar:user-id-bold-duotone" size={16} />
									{t(`${ns}.login_identifier_both`)}
								</Space>
							</Select.Option>
						</Select>
					</Form.Item>
				</Col>
				<Col xs={24} sm={24} md={8}>
					<Form.Item
						label={
							<Space>
								<span>{t(`${ns}.auth_request_expiry`)}</span>
								<Tooltip title={t(`${ns}.auth_request_expiry_tooltip`)}>
									<InfoCircleOutlined style={{ color: "#8c8c8c" }} />
								</Tooltip>
							</Space>
						}
						name="auth_request_expiry"
						rules={[{ required: true, message: t(`${ns}.auth_request_expiry_required`) }]}
					>
						<InputNumber
							min={1}
							style={{ width: "100%" }}
							size="large"
							addonAfter={t(`${ns}.auth_request_expiry_unit`)}
							placeholder="60"
						/>
					</Form.Item>
				</Col>
				<Col xs={24} sm={24} md={8}>
					<Form.Item
						label={
							<Space>
								<span>{t(`${ns}.duplicate_request_limit`)}</span>
								<Tooltip title={t(`${ns}.duplicate_request_limit_tooltip`)}>
									<InfoCircleOutlined style={{ color: "#8c8c8c" }} />
								</Tooltip>
							</Space>
						}
						name="duplicate_request_limit"
					>
						<InputNumber
							min={0}
							style={{ width: "100%" }}
							size="large"
							addonAfter={t(`${ns}.duplicate_request_limit_unit`)}
							placeholder={t(`${ns}.duplicate_request_limit_placeholder`)}
						/>
					</Form.Item>
				</Col>
			</Row>
		</Card>
	);
}
