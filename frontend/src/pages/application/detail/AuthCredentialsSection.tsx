import {
	Button,
	Card,
	Col,
	Popconfirm,
	Row,
	Space,
	Tag,
	Typography,
} from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";
import type { Application } from "@/api/services/application";

const { Text } = Typography;

const credentialCodeStyle = {
	background: "rgba(255,255,255,0.2)",
	color: "#fff",
	padding: "8px 12px",
	borderRadius: "4px",
	fontSize: "13px",
	fontFamily: "monospace",
	flex: "1 1 0",
	minWidth: 0,
	maxWidth: "100%",
	display: "block",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
} as const;

const copyButtonStyle = {
	color: "#fff",
	flex: "0 0 28px",
} as const;

interface AuthCredentialsSectionProps {
	application: Application;
	showSecret: boolean;
	newSecret: string | null;
	regenerating: boolean;
	onCopy: (text: string) => void;
	onRegenerateSecret: () => void;
}

export function AuthCredentialsSection({
	application,
	showSecret,
	newSecret,
	regenerating,
	onCopy,
	onRegenerateSecret,
}: AuthCredentialsSectionProps) {
	const { t } = useTranslation();
	const ns = "sys.menu.application.detailPage";

	return (
		<Row gutter={[16, 16]}>
			<Col xs={24} sm={24} md={12}>
				<Card
					size="small"
					style={{
						background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
						border: "none",
						borderRadius: "8px",
					}}
					styles={{ body: { padding: "16px" } }}
				>
					<Space direction="vertical" className="w-full">
						<Text style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
							{t(`${ns}.client_id`)}
						</Text>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								minWidth: 0,
							}}
						>
							<Text code style={credentialCodeStyle} ellipsis>
								{application.clientId}
							</Text>
							<Button
								type="text"
								icon={<CopyOutlined />}
								onClick={() => onCopy(application.clientId)}
								style={copyButtonStyle}
								size="small"
							/>
						</div>
					</Space>
				</Card>
			</Col>
			<Col xs={24} sm={24} md={12}>
				<Card
					size="small"
					style={{
						background:
							showSecret && newSecret
								? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
								: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
						border: "none",
						borderRadius: "8px",
					}}
					styles={{ body: { padding: "16px" } }}
				>
					<Space direction="vertical" className="w-full">
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								gap: "8px",
								flexWrap: "wrap",
								width: "100%",
							}}
						>
							<Text
								style={{
									color: "rgba(255,255,255,0.8)",
									fontSize: "12px",
									flex: "1 1 120px",
								}}
							>
								{t(`${ns}.client_secret`)}
							</Text>
							<Space size={8} wrap>
								{showSecret && newSecret && (
									<Tag color="warning" style={{ margin: 0 }}>
										{t(`${ns}.newly_issued`)}
									</Tag>
								)}
								<Popconfirm
									title={t(`${ns}.regenerate_title`)}
									description={
										<div>
											<p>{t(`${ns}.regenerate_description`)}</p>
											<p
												style={{
													marginTop: "8px",
													color: "#ff4d4f",
													fontWeight: "bold",
												}}
											>
												{t(`${ns}.regenerate_warning`)}
											</p>
										</div>
									}
									onConfirm={onRegenerateSecret}
									okText={t(`${ns}.regenerate_confirm`)}
									cancelText={t(`${ns}.regenerate_cancel`)}
									okButtonProps={{ danger: true, loading: regenerating }}
								>
									<Button
										type="text"
										danger
										loading={regenerating}
										style={{
											color: "rgba(255,255,255,0.9)",
											padding: "4px 8px",
											height: "auto",
											fontSize: "12px",
											cursor: "pointer",
											transition: "all 0.2s ease",
										}}
										className="regenerate-secret-btn"
										size="small"
										icon={
											<Iconify icon="solar:refresh-bold-duotone" size={14} />
										}
										onMouseEnter={(e) => {
											e.currentTarget.style.color = "#fff";
											e.currentTarget.style.backgroundColor =
												"rgba(255,255,255,0.15)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.color = "rgba(255,255,255,0.9)";
											e.currentTarget.style.backgroundColor = "transparent";
										}}
									>
										{t(`${ns}.regenerate`)}
									</Button>
								</Popconfirm>
							</Space>
						</div>
						{showSecret && newSecret ? (
							<Space direction="vertical" className="w-full" size="small">
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										minWidth: 0,
									}}
								>
									<Text code style={credentialCodeStyle} ellipsis>
										{newSecret}
									</Text>
									<Button
										type="text"
										icon={<CopyOutlined />}
										onClick={() => onCopy(newSecret)}
										style={copyButtonStyle}
										size="small"
									/>
								</div>
								<div
									style={{
										marginTop: "8px",
										padding: "12px",
										borderRadius: "8px",
										border: "1px solid rgba(255,255,255,0.35)",
										background: "rgba(255,255,255,0.14)",
										display: "flex",
										gap: "10px",
										alignItems: "flex-start",
									}}
								>
									<Iconify
										icon="solar:danger-triangle-bold-duotone"
										size={18}
										style={{
											color: "#fbbf24",
											flex: "0 0 18px",
											marginTop: "1px",
										}}
									/>
									<div style={{ minWidth: 0 }}>
										<Text
											strong
											style={{
												color: "#fff",
												display: "block",
												marginBottom: "4px",
											}}
										>
											{t(`${ns}.secret_important`)}
										</Text>
										<Text
											style={{
												color: "rgba(255,255,255,0.88)",
												lineHeight: 1.55,
											}}
										>
											{t(`${ns}.secret_important_desc`)}
										</Text>
									</div>
								</div>
							</Space>
						) : (
							<Space
								className="w-full"
								style={{ justifyContent: "space-between" }}
							>
								<Text
									style={{
										color: "rgba(255,255,255,0.6)",
										fontSize: "14px",
										letterSpacing: "2px",
									}}
								>
									••••••••••••••••
								</Text>
							</Space>
						)}
					</Space>
				</Card>
			</Col>
		</Row>
	);
}
