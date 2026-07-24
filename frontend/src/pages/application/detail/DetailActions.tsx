import { Button, Card, Space } from "antd";
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";

interface DetailActionsProps {
	onCancel: () => void;
}

export function DetailActions({ onCancel }: DetailActionsProps) {
	const { t } = useTranslation();
	const ns = "sys.menu.application.detailPage";

	return (
		<Card
			style={{
				borderRadius: "12px",
				boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
				background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
				marginBottom: "24px",
			}}
		>
			<Space style={{ width: "100%", justifyContent: "flex-end" }}>
				<Button onClick={onCancel} size="large">
					{t(`${ns}.cancel`)}
				</Button>
				<Button
					type="primary"
					htmlType="submit"
					size="large"
					icon={<Iconify icon="solar:check-circle-bold-duotone" size={18} />}
				>
					{t(`${ns}.save_changes`)}
				</Button>
			</Space>
		</Card>
	);
}
