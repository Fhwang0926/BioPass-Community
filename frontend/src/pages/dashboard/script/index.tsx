import {
	Alert,
	Button,
	Card,
	Col,
	Empty,
	Row,
	Space,
	Spin,
	Tag,
	Typography,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "@/utils/dayjs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import applicationService, { type Application, type ApplicationListResponse } from "@/api/services/application";
import authService, { type DashboardData } from "@/api/services/auth";
import Chart from "@/components/chart/chart";
import useChart from "@/components/chart/useChart";
import { Iconify } from "@/components/icon";
import { useUserInfo } from "@/store/userStore";
import { themeVars } from "@/theme/theme.css";
import useLocale from "@/locales/use-locale";
import { formatNumber as formatLocaleNumber } from "@/locales/locale-meta";

const { Text, Title } = Typography;

const EMPTY_DASHBOARD: DashboardData = {
	kpi: {
		weekRequestsCount: 0,
		successRate: 0,
		avgTimeSeconds: 0,
		pendingCount: 0,
	},
	statusDistribution: {
		APPROVED: 0,
		DENIED: 0,
		EXPIRED: 0,
		BLOCKED: 0,
		CONSUMED: 0,
		PENDING: 0,
		CREATED: 0,
	},
	dailyTrend: Array.from({ length: 7 }, (_, day) => ({ day, count: 0 })),
	recentRequests: [],
	riskEvents: {
		NEW_DEVICE: 0,
		COUNTRY_CHANGE: 0,
		ABUSE: 0,
	},
	weekSuccessCount: 0,
};

const statusColors: Record<string, string> = {
	CREATED: "cyan",
	PENDING: "orange",
	APPROVED: "blue",
	CONSUMED: "green",
	DENIED: "red",
	EXPIRED: "default",
	BLOCKED: "volcano",
};

function formatPercent(value: number | null | undefined) {
	return `${Number(value || 0).toFixed(2)}%`;
}

function unwrapPayload<T>(value: unknown): T | null {
	if (!value || typeof value !== "object") return (value as T) ?? null;
	const record = value as Record<string, unknown>;
	return (record.data ?? value) as T;
}

function normalizeDashboardData(value: unknown): DashboardData {
	const data = unwrapPayload<Partial<DashboardData>>(value) || {};
	const kpi = data.kpi || {};
	const statusDistribution = data.statusDistribution || {};
	const riskEvents = data.riskEvents || {};

	return {
		...EMPTY_DASHBOARD,
		...data,
		kpi: {
			...EMPTY_DASHBOARD.kpi,
			...kpi,
		},
		statusDistribution: {
			...EMPTY_DASHBOARD.statusDistribution,
			...statusDistribution,
		},
		dailyTrend: Array.isArray(data.dailyTrend) ? data.dailyTrend : EMPTY_DASHBOARD.dailyTrend,
		recentRequests: Array.isArray(data.recentRequests) ? data.recentRequests : EMPTY_DASHBOARD.recentRequests,
		riskEvents: {
			...EMPTY_DASHBOARD.riskEvents,
			...riskEvents,
		},
		weekSuccessCount: Number(data.weekSuccessCount || 0),
	};
}

function isAppActive(app: Application) {
	return Boolean((app as any).isActive ?? (app as any).is_active);
}

function appName(app: Application, fallback: string) {
	return String((app as any).name || fallback);
}

function appClientId(app: Application) {
	return String((app as any).clientId ?? (app as any).client_id ?? "-");
}

function appLastAuthAt(app: Application) {
	return (app as any).lastAuthRequestAt ?? (app as any).last_auth_request_at;
}

function MetricCard({
	title,
	value,
	unit,
	icon,
	color,
	subtitle,
}: {
	title: string;
	value: string;
	unit?: string;
	icon: string;
	color: string;
	subtitle: string;
}) {
	return (
		<Card bordered style={{ borderRadius: 8, height: "100%" }} styles={{ body: { padding: 18 } }}>
			<Space direction="vertical" size={14} className="w-full">
				<div className="flex items-start justify-between gap-3">
					<Text type="secondary" className="text-sm">
						{title}
					</Text>
					<div
						className="flex h-10 w-10 items-center justify-center rounded-md"
						style={{ backgroundColor: `${color}18`, color }}
					>
						<Iconify icon={icon} size={22} />
					</div>
				</div>
				<div>
					<span className="text-3xl font-semibold leading-none" style={{ color }}>
						{value}
					</span>
					{unit && <span className="ml-1 text-base font-medium text-gray-500">{unit}</span>}
				</div>
				<Text type="secondary" className="text-xs">
					{subtitle}
				</Text>
			</Space>
		</Card>
	);
}

export default function AdminDashboard() {
	const { t } = useTranslation();
	const { meta } = useLocale();
	const formatNumber = (value: number | null | undefined) =>
		formatLocaleNumber(Number(value || 0), meta.bcp47);
	const statusLabels: Record<string, string> = {
		CREATED: t("sys.page.dashboard.status.created"),
		PENDING: t("sys.page.dashboard.status.pending"),
		APPROVED: t("sys.page.dashboard.status.approved"),
		CONSUMED: t("sys.page.dashboard.status.consumed"),
		DENIED: t("sys.page.dashboard.status.denied"),
		EXPIRED: t("sys.page.dashboard.status.expired"),
		BLOCKED: t("sys.page.dashboard.status.blocked"),
	};
	const riskLabels: Record<keyof DashboardData["riskEvents"], string> = {
		NEW_DEVICE: t("sys.page.dashboard.risk.newDevice"),
		COUNTRY_CHANGE: t("sys.page.dashboard.risk.countryChange"),
		ABUSE: t("sys.page.dashboard.risk.abuse"),
	};
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const userInfo = useUserInfo();
	const companyId = userInfo.company_id;

	const dashboardQuery = useQuery({
		queryKey: ["adminDashboard"],
		queryFn: authService.getDashboard,
		refetchInterval: 60 * 1000,
	});

	const applicationsQuery = useQuery({
		queryKey: ["dashboardApplications", companyId],
		queryFn: () => applicationService.getApplicationList({ page: 1, limit: 5 }),
		enabled: !!companyId,
	});

	const dashboardData = normalizeDashboardData(dashboardQuery.data);
	const appListResponse = unwrapPayload<ApplicationListResponse>(applicationsQuery.data) || undefined;
	const applications = Array.isArray(appListResponse?.data) ? appListResponse.data : [];
	const totalApplications = Number(appListResponse?.pagination?.total ?? applications.length);
	const riskItems = (Object.keys(riskLabels) as Array<keyof DashboardData["riskEvents"]>).map((key) => ({
		key,
		label: riskLabels[key],
		value: Number(dashboardData.riskEvents?.[key] || 0),
		color: key === "COUNTRY_CHANGE" ? "#f59e0b" : "#ef4444",
	}));
	const riskTotal = riskItems.reduce((sum, item) => sum + item.value, 0);
	const activeRecentApplications = applications.filter(isAppActive).length;
	const inactiveRecentApplications = Math.max(applications.length - activeRecentApplications, 0);
	const lastUpdated = dashboardQuery.dataUpdatedAt ? dayjs(dashboardQuery.dataUpdatedAt).format("HH:mm:ss") : "-";
	const anyLoading = dashboardQuery.isLoading || applicationsQuery.isLoading;
	const anyFetching = dashboardQuery.isFetching || applicationsQuery.isFetching;

	const dailyTrend = dashboardData.dailyTrend?.length ? dashboardData.dailyTrend : EMPTY_DASHBOARD.dailyTrend;
	const dailyCategories = dailyTrend.map((item) => {
		const baseDay = dayjs().startOf("day").subtract(6 - Number(item.day || 0), "days");
		return baseDay.format("MM/DD");
	});

	const dailyChartOptions = useChart({
		chart: { sparkline: { enabled: false } },
		colors: ["#2563eb"],
		xaxis: {
			categories: dailyCategories,
			labels: { rotate: -35, style: { fontSize: "11px" } },
		},
		yaxis: {
			labels: {
				formatter: (value: number) => formatNumber(value),
			},
		},
		grid: {
			strokeDashArray: 3,
			borderColor: themeVars.colors.background.neutral,
		},
		tooltip: {
			y: {
				formatter: (value: number) => `${formatNumber(value)}${t("common.countUnit")}`,
			},
		},
	});

	const statusItems = [
		"CONSUMED",
		"APPROVED",
		"PENDING",
		"DENIED",
		"EXPIRED",
		"BLOCKED",
	].map((status) => ({
		status,
		label: statusLabels[status],
		value: Number((dashboardData.statusDistribution as any)?.[status] || 0),
	}));
	const statusTotal = statusItems.reduce((sum, item) => sum + item.value, 0);
	const statusChartOptions = useChart({
		labels: statusItems.map((item) => item.label),
		legend: { position: "bottom", horizontalAlign: "center" },
		colors: ["#16a34a", "#2563eb", "#f59e0b", "#ef4444", "#94a3b8", "#f97316"],
		dataLabels: { enabled: false },
		plotOptions: {
			pie: {
				donut: {
					size: "72%",
					labels: {
						show: true,
						total: {
							show: true,
							label: t("sys.page.dashboard.total"),
							formatter: () => formatNumber(statusTotal),
						},
					},
				},
			},
		},
	});

	const riskChartOptions = useChart({
		chart: { toolbar: { show: false } },
		colors: riskItems.map((item) => item.color),
		dataLabels: { enabled: false },
		plotOptions: {
			bar: {
				horizontal: true,
				borderRadius: 4,
				distributed: true,
				barHeight: "54%",
			},
		},
		xaxis: {
			categories: riskItems.map((item) => item.label),
			labels: {
				formatter: (value: string) => formatNumber(Number(value)),
			},
		},
		grid: {
			strokeDashArray: 3,
			borderColor: themeVars.colors.background.neutral,
		},
		tooltip: {
			y: {
				formatter: (value: number) => `${formatNumber(value)}${t("common.countUnit")}`,
			},
		},
	});

	const appStatusChartOptions = useChart({
		labels: [t("common.active"), t("common.inactive")],
		legend: { position: "bottom", horizontalAlign: "center" },
		colors: ["#16a34a", "#ef4444"],
		dataLabels: { enabled: false },
		plotOptions: {
			pie: {
				donut: {
					size: "70%",
					labels: {
						show: true,
						total: {
							show: true,
							label: t("sys.page.dashboard.recentApps"),
							formatter: () => formatNumber(applications.length),
						},
					},
				},
			},
		},
	});

	const recentRequestsPreview = dashboardData.recentRequests.slice(0, 6);

	const refreshAll = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["adminDashboard"] }),
			queryClient.invalidateQueries({ queryKey: ["dashboardApplications", companyId] }),
		]);
	};

	if (anyLoading && !dashboardQuery.data) {
		return (
			<div className="flex h-72 items-center justify-center">
				<Spin size="large" />
			</div>
		);
	}

	return (
		<Space direction="vertical" size={20} className="w-full p-2">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<Title level={2} className="!mb-0">
						{t("sys.page.dashboard.title")}
					</Title>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
						<span>{t("sys.page.dashboard.lastUpdated", { time: lastUpdated })}</span>
					</div>
				</div>
				<Space wrap>
					<Button icon={<ReloadOutlined />} loading={anyFetching} onClick={refreshAll}>
						{t("common.redo")}
					</Button>
				</Space>
			</div>

			{dashboardQuery.isError && (
				<Alert
					showIcon
					type="warning"
					message={t("sys.page.dashboard.loadError")}
					description={t("sys.page.dashboard.loadErrorDesc")}
				/>
			)}

			{totalApplications === 0 && (
				<Card bordered style={{ borderRadius: 8 }}>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<Space align="start" size={14}>
							<div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
								<Iconify icon="mdi:application-import" size={24} />
							</div>
							<div>
								<Title level={4} className="!mb-1">
									{t("sys.page.dashboard.connectFirstApp")}
								</Title>
								<Text type="secondary">
									{t("sys.page.dashboard.connectFirstAppDesc")}
								</Text>
							</div>
						</Space>
						<Button type="primary" onClick={() => navigate("/service/application/create")}>
							{t("sys.page.dashboard.createFirstApp")}
						</Button>
					</div>
				</Card>
			)}

			<Row gutter={[16, 16]}>
				<Col xs={24} sm={12} xl={6}>
					<MetricCard
						title={t("sys.page.dashboard.weekRequests")}
						value={formatNumber(dashboardData.kpi.weekRequestsCount)}
						icon="solar:login-3-bold-duotone"
						color="#2563eb"
						subtitle={t("sys.page.dashboard.weekRequestsDesc")}
					/>
				</Col>
				<Col xs={24} sm={12} xl={6}>
					<MetricCard
						title={t("sys.page.dashboard.successRate")}
						value={formatPercent(dashboardData.kpi.successRate)}
						icon="solar:check-circle-bold-duotone"
						color="#16a34a"
						subtitle={t("sys.page.dashboard.successRateDesc")}
					/>
				</Col>
				<Col xs={24} sm={12} xl={6}>
					<MetricCard
						title={t("sys.page.dashboard.avgAuthTime")}
						value={Number(dashboardData.kpi.avgTimeSeconds || 0).toFixed(2)}
						unit={t("common.secondsUnit")}
						icon="solar:clock-circle-bold-duotone"
						color="#f59e0b"
						subtitle={t("sys.page.dashboard.avgAuthTimeDesc")}
					/>
				</Col>
				<Col xs={24} sm={12} xl={6}>
					<MetricCard
						title={t("sys.page.dashboard.pendingAndRisk")}
						value={`${formatNumber(dashboardData.kpi.pendingCount)} / ${formatNumber(riskTotal)}`}
						icon="solar:shield-warning-bold-duotone"
						color="#ef4444"
						subtitle={t("sys.page.dashboard.pendingAndRiskDesc")}
					/>
				</Col>
			</Row>

			<Row gutter={[16, 16]}>
				<Col xs={24} xl={16}>
					<Card title={t("sys.page.dashboard.weekRequests")} bordered style={{ borderRadius: 8 }}>
						<Chart
							type="area"
							height={280}
							options={dailyChartOptions}
							series={[{ name: t("sys.page.dashboard.authRequests"), data: dailyTrend.map((item) => item.count || 0) }]}
						/>
					</Card>
				</Col>
				<Col xs={24} xl={8}>
					<Card title={t("sys.page.dashboard.weekStatus")} bordered style={{ borderRadius: 8, height: "100%" }}>
						{statusTotal > 0 ? (
							<Chart
								type="donut"
								height={280}
								options={statusChartOptions}
								series={statusItems.map((item) => item.value)}
							/>
						) : (
							<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("sys.page.dashboard.noWeekData")} />
						)}
					</Card>
				</Col>
			</Row>

			<Row gutter={[16, 16]}>
				<Col xs={24} xl={12}>
					<Card
						title={t("sys.page.dashboard.riskEvents")}
						extra={<Tag color={riskTotal > 0 ? "red" : "green"}>{formatNumber(riskTotal)}{t("common.countUnit")}</Tag>}
						bordered
						style={{ borderRadius: 8 }}
					>
						{riskTotal > 0 ? (
							<Chart
								type="bar"
								height={220}
								options={riskChartOptions}
								series={[{ name: t("sys.page.dashboard.riskEvents"), data: riskItems.map((item) => item.value) }]}
							/>
						) : (
							<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("sys.page.dashboard.noRiskEvents")} />
						)}
						<Row gutter={[12, 12]} className="mt-3">
							{riskItems.map((item) => (
								<Col xs={24} md={8} key={item.key}>
									<div className="rounded-md border p-3">
										<Space size={8}>
											<span
												className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white"
												style={{ backgroundColor: item.color }}
											>
												<Iconify icon="mdi:alert-outline" size={18} />
											</span>
											<span>
												<Text type="secondary" className="block text-xs">
													{item.label}
												</Text>
												<Text strong>{formatNumber(item.value)}{t("common.countUnit")}</Text>
											</span>
										</Space>
									</div>
								</Col>
							))}
						</Row>
					</Card>
				</Col>
				<Col xs={24} xl={12}>
					<Card
						title={t("sys.page.dashboard.applicationStatus")}
						extra={<Tag color="blue">{t("sys.page.dashboard.recentCount", { count: applications.length })}</Tag>}
						bordered
						style={{ borderRadius: 8, height: "100%" }}
					>
						<Row gutter={[16, 16]} align="middle">
							<Col xs={24} md={10}>
								{applications.length > 0 ? (
									<Chart
										type="donut"
										height={230}
										options={appStatusChartOptions}
										series={[activeRecentApplications, inactiveRecentApplications]}
									/>
								) : (
									<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("sys.page.dashboard.noApps")} />
								)}
							</Col>
							<Col xs={24} md={14}>
								<Space direction="vertical" size={10} className="w-full">
									{applications.length > 0 ? (
										applications.map((app) => {
											const lastAuthAt = appLastAuthAt(app);
											return (
												<div key={app.id} className="rounded-md border p-3">
													<div className="flex items-start justify-between gap-3">
														<div className="min-w-0">
															<Text strong className="block truncate">
																{appName(app, t("sys.page.dashboard.unnamed"))}
															</Text>
															<Text type="secondary" className="block truncate text-xs">
																{appClientId(app)}
															</Text>
														</div>
														<Tag color={isAppActive(app) ? "success" : "error"} style={{ marginInlineEnd: 0 }}>
															{isAppActive(app) ? t("common.active") : t("common.inactive")}
														</Tag>
													</div>
													<Text type="secondary" className="mt-2 block text-xs">
														{t("sys.page.dashboard.lastAuth", { time: lastAuthAt ? dayjs(lastAuthAt).format("MM-DD HH:mm") : "-" })}
													</Text>
												</div>
											);
										})
									) : (
										<Text type="secondary">{t("sys.page.dashboard.appStatusHint")}</Text>
									)}
								</Space>
							</Col>
						</Row>
					</Card>
				</Col>
			</Row>

			<Card
				title={t("sys.page.dashboard.recentRequests")}
				extra={<Tag color="blue">{formatNumber(recentRequestsPreview.length)}{t("common.countUnit")}</Tag>}
				bordered
				style={{ borderRadius: 8 }}
			>
				{recentRequestsPreview.length > 0 ? (
					<Row gutter={[12, 12]}>
						{recentRequestsPreview.map((request) => (
							<Col xs={24} md={12} xl={8} key={request.id}>
								<div className="h-full rounded-md border p-3">
									<div className="mb-3 flex items-start justify-between gap-3">
										<Tag color={statusColors[request.status] || "default"} style={{ marginInlineEnd: 0 }}>
											{statusLabels[request.status] || request.status}
										</Tag>
										<Text type="secondary" className="text-xs">
											{dayjs(request.createdAt).fromNow()}
										</Text>
									</div>
									<Text strong className="block truncate">
										{request.appName || "-"}
									</Text>
									<Text type="secondary" className="block truncate text-xs">
										{request.userIdentifier || "-"}
									</Text>
									<div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
										<span>{dayjs(request.createdAt).format("MM-DD HH:mm")}</span>
										<span className="truncate">
											{request.country || "-"} · {request.devicePlatform || "-"}
										</span>
									</div>
								</div>
							</Col>
						))}
					</Row>
				) : (
					<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("sys.page.dashboard.noRecentRequests")} />
				)}
			</Card>
		</Space>
	);
}
