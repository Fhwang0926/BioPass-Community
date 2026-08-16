import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
	Button,
	Card,
	Col,
	DatePicker,
	Form,
	Input,
	Row,
	Select,
	Space,
	Table,
	Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import dayjs from "@/utils/dayjs";
import { useTranslation } from "react-i18next";

import authLogService, { type AuthLog, type AuthLogListResponse, type SearchParams } from "@/api/services/auth-log";

const { RangePicker } = DatePicker;

export default function AuthLogPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [searchForm] = Form.useForm();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 20,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<SearchParams>({ page: 1, limit: 20 });

	const getStatusTag = (status: string) => {
		const statusMap: Record<string, { color: string; text: string }> = {
			CREATED: { color: "processing", text: t("sys.page.authLog.status.created") },
			APPROVED: { color: "success", text: t("sys.page.authLog.status.approved") },
			DENIED: { color: "error", text: t("sys.page.authLog.status.denied") },
			EXPIRED: { color: "warning", text: t("sys.page.authLog.status.expired") },
			BLOCKED: { color: "error", text: t("sys.page.authLog.status.blocked") },
			PENDING: { color: "processing", text: t("sys.page.authLog.status.pending") },
			CONSUMED: { color: "default", text: t("sys.page.authLog.status.consumed") },
		};
		const statusInfo = statusMap[status] || { color: "default", text: status };
		return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
	};

	const columns: ColumnsType<AuthLog> = [
		{
			title: t("sys.page.authLog.time"),
			dataIndex: "createdAt",
			width: 180,
			render: (timestamp) => dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss"),
			sorter: true,
		},
		{
			title: t("sys.page.authLog.user"),
			dataIndex: "maskedUser",
			width: 200,
			render: (text) => <code className="text-sm">{text || "-"}</code>,
		},
		{
			title: t("sys.page.authLog.app"),
			dataIndex: "appName",
			width: 150,
		},
		{
			title: t("common.statusText"),
			dataIndex: "status",
			width: 100,
			render: (status) => getStatusTag(status),
		},
		{
			title: t("sys.page.authLog.countryIp"),
			width: 200,
			render: (_, record) => (
				<Space direction="vertical" size="small">
					{record.country && <Tag>{record.country}</Tag>}
					<code className="text-xs">{record.requestIp || "-"}</code>
				</Space>
			),
		},
		{
			title: t("sys.page.authLog.device"),
			width: 180,
			render: (_, record) => {
				const getDeviceTypeLabel = (dt: string) => {
				const map: Record<string, string> = { PC: "PC", Mobile: t("sys.page.authLog.mobile"), App: t("sys.page.authLog.app") };
					return map[dt] ?? dt;
				};
				const parseBrowserLabel = (ua: string): string => {
					if (!ua || typeof ua !== "string") return "";
					const chrome = ua.match(/Chrome\/(\d+)/)?.[1];
					const edge = ua.match(/Edg\/(\d+)/)?.[1];
					const firefox = ua.match(/Firefox\/(\d+)/)?.[1];
					const safari = ua.match(/Version\/(\d+).*Safari/)?.[1];
					const os = ua.includes("Windows") ? "Win" : ua.includes("Mac") ? "Mac" : ua.includes("Android") ? "And" : ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "";
					if (edge) return `Edge${os ? `/${os}` : ""}`;
					if (chrome && !ua.includes("Edg")) return `Chrome${os ? `/${os}` : ""}`;
					if (firefox) return `Firefox${os ? `/${os}` : ""}`;
					if (safari) return `Safari${os ? `/${os}` : ""}`;
					return "";
				};
				const browserLabel = record.browserInfo ? parseBrowserLabel(record.browserInfo) : "";
				return (
					<Space direction="vertical" size="small">
						{record.devicePlatform && record.devicePlatform !== "-" && (
							<Space size="small" wrap>
								<Tag color={record.devicePlatform === "email" ? "cyan" : record.devicePlatform === "ios" ? "blue" : "green"}>
									{record.devicePlatform === "email" ? t("sys.page.authLog.email") : record.devicePlatform.toUpperCase()}
								</Tag>
								{record.devicePlatform === "email" && record.deviceType && (
									<Tag color={record.deviceType === "PC" ? "blue" : record.deviceType === "Mobile" ? "geekblue" : "green"}>
										{getDeviceTypeLabel(record.deviceType)}
									</Tag>
								)}
							</Space>
						)}
						{record.deviceName && record.deviceName !== "-" && record.devicePlatform !== "email" && (
							<span className="text-xs text-gray-500">{record.deviceName}</span>
						)}
						{record.devicePlatform === "email" && browserLabel && (
							<span className="text-xs text-gray-400" title={record.browserInfo}>{browserLabel}</span>
						)}
						{(!record.devicePlatform || record.devicePlatform === "-") && (!record.deviceName || record.deviceName === "-") && "-"}
					</Space>
				);
			},
		},
		{
			title: t("common.actionText"),
			key: "operation",
			width: 100,
			render: (_, record) => (
				<Button
					type="link"
					onClick={() => navigate(`/auth-log/${record.id}`)}
				>
					{t("common.detail")}
				</Button>
			),
		},
	];

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["auth-log", searchParams, pagination.current, pagination.pageSize],
		queryFn: () => authLogService.getAuthLogList({
			...searchParams,
			page: pagination.current,
			limit: pagination.pageSize,
		}),
	});

	// apiClient가 한 단계만 풀어서 반환 → data = { data: AuthLog[], pagination }
	const list: AuthLog[] = Array.isArray(data?.data) ? data.data : [];
	const listPagination =
		data && typeof data === "object" ? (data as AuthLogListResponse).pagination : undefined;

	useEffect(() => {
		if (listPagination?.total != null) {
			const totalNum = Number(listPagination.total);
			setPagination((prev) =>
				prev.total !== totalNum ? { ...prev, total: totalNum } : prev
			);
		}
	}, [listPagination?.total]);

	const onSearch = () => {
		const values = searchForm.getFieldsValue();
		const params: SearchParams = {};
		
		if (values.status) params.status = values.status;
		if (values.app_id) params.app_id = values.app_id;
		if (values.user_id) params.user_id = values.user_id;
		if (values.country) params.country = values.country;
		if (values.request_ip) params.request_ip = values.request_ip;
		if (values.dateRange && values.dateRange.length === 2) {
			params.start_date = values.dateRange[0].format('YYYY-MM-DD');
			params.end_date = values.dateRange[1].format('YYYY-MM-DD');
		}

		setSearchParams(params);
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const onReset = () => {
		searchForm.resetFields();
		setSearchParams({ page: 1, limit: 20 });
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const handleTableChange = (newPagination: { current?: number; pageSize?: number }) => {
		setPagination((prev) => ({
			...prev,
			current: newPagination.current ?? prev.current,
			pageSize: newPagination.pageSize ?? prev.pageSize,
		}));
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch} layout="inline">
					<Row gutter={[16, 16]} className="w-full">
						<Col span={24} lg={6}>
							<Form.Item name="status" label={t("common.statusText")}>
								<Select allowClear placeholder={t("sys.page.authLog.all")}>
									{["CREATED", "APPROVED", "DENIED", "EXPIRED", "BLOCKED", "PENDING", "CONSUMED"].map((status) => (
										<Select.Option key={status} value={status}>{t(`sys.page.authLog.status.${status.toLowerCase()}`)}</Select.Option>
									))}
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<Form.Item name="country" label={t("sys.page.authLog.country")}>
								<Input placeholder={t("sys.page.authLog.countryPlaceholder")} />
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<Form.Item name="request_ip" label={t("sys.page.authLog.ipAddress")}>
								<Input placeholder={t("sys.page.authLog.ipPlaceholder")} />
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<Form.Item name="dateRange" label={t("sys.page.authLog.period")}>
								<RangePicker style={{ width: "100%" }} />
							</Form.Item>
						</Col>
						<Col span={24}>
							<Space>
								<Button onClick={onReset}>{t("common.resetText")}</Button>
								<Button type="primary" htmlType="submit">
									{t("common.searchText")}
								</Button>
							</Space>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card title={t("sys.menu.authLog")}>
				{isError && (
					<div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-red-700">
						{(error as Error)?.message ?? t("sys.page.authLog.loadError")}
					</div>
				)}
				<Table
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={isLoading}
					columns={columns}
					dataSource={list}
					locale={{ emptyText: isLoading ? t("common.loadingText") : t("common.noData") }}
					pagination={{
						current: pagination.current,
						pageSize: pagination.pageSize,
						total: Number(listPagination?.total ?? 0),
						showSizeChanger: true,
						showQuickJumper: true,
					}}
					onChange={handleTableChange}
				/>
			</Card>
		</Space>
	);
}

