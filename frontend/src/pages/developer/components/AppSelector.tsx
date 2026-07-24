import { useQuery } from "@tanstack/react-query";
import { Alert, Select, Space, Typography } from "antd";
import { Link } from "react-router";

import applicationService, { type Application } from "@/api/services/application";
import { t } from "@/locales/i18n";
import { normalizeApplicationFields } from "@/utils/bioPassApi";

const { Text } = Typography;

interface AppSelectorProps {
	value: Application | null;
	onChange: (app: Application | null) => void;
}

export function AppSelector({ value, onChange }: AppSelectorProps) {
	const { data, isLoading } = useQuery({
		queryKey: ["developer-apps"],
		queryFn: () => applicationService.getApplicationList({ limit: 100, page: 1 }),
	});

	const apps = data?.data ?? [];

	return (
		<Space direction="vertical" size="middle" className="w-full">
			<div>
				<Text strong>{t("sys.menu.developer.selectApp")}</Text>
				<Select
					className="w-full mt-2"
					placeholder={t("sys.menu.developer.selectAppPlaceholder")}
					loading={isLoading}
					value={value?.id}
					allowClear
					onChange={(id) => {
						const app = apps.find((a) => a.id === id) ?? null;
						onChange(app);
					}}
					options={apps.map((app) => ({
						value: app.id,
						label: app.name,
					}))}
				/>
			</div>

			{!isLoading && apps.length === 0 && (
				<Alert
					type="info"
					showIcon
					message={t("sys.menu.developer.noApps")}
					action={
						<Link to="/service/application/create">{t("sys.menu.developer.createAppLink")}</Link>
					}
				/>
			)}

			{value && (
				<div
					style={{
						padding: 12,
						background: "#fafafa",
						borderRadius: 8,
						border: "1px solid #f0f0f0",
					}}
				>
					{(() => {
						const { clientId, callbackUrl } = normalizeApplicationFields(value);
						return (
							<Space direction="vertical" size={4} className="w-full">
								<div>
									<Text type="secondary">Client ID: </Text>
									<Text code copyable>
										{clientId}
									</Text>
								</div>
								<div>
									<Text type="secondary">Callback URL: </Text>
									<Text code copyable>
										{callbackUrl || "—"}
									</Text>
								</div>
								<Text type="secondary" style={{ fontSize: 12 }}>
									{t("sys.menu.developer.secretHint")}{" "}
									<Link to={`/service/application/${value.id}`}>
										{t("sys.menu.developer.appDetailLink")}
									</Link>
								</Text>
							</Space>
						);
					})()}
				</div>
			)}
		</Space>
	);
}
