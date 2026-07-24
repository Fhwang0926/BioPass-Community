import { Button, Card, Divider, Space, Tag, Typography } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";
import type { Application } from "@/api/services/application";

interface DetailHeaderProps {
	application: Application;
	onBack: () => void;
}

export function DetailHeader({ application, onBack }: DetailHeaderProps) {
	const { t } = useTranslation();
	const ns = "sys.menu.application.detailPage";

	return (
		<Card
			style={{
				borderRadius: "12px",
				boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
				marginBottom: "24px",
			}}
		>
			<Space style={{ width: "100%", justifyContent: "space-between" }}>
				<Space>
					<Button onClick={onBack} icon={<Iconify icon="solar:arrow-left-bold" size={18} />}>
						{t(`${ns}.back_to_list`)}
					</Button>
					<Divider type="vertical" />
					<Space>
						<Iconify icon="solar:app-window-bold-duotone" size={24} style={{ color: "#1890ff" }} />
						<Typography.Text strong style={{ fontSize: "18px" }}>
							{application.name}
						</Typography.Text>
						{application.isActive ? (
							<Tag color="success" icon={<CheckCircleOutlined />}>
								{t(`${ns}.active`)}
							</Tag>
						) : (
							<Tag color="default">{t(`${ns}.inactive`)}</Tag>
						)}
					</Space>
				</Space>
			</Space>
		</Card>
	);
}
