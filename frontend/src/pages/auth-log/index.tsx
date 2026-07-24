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

import authLogService, { type AuthLog, type AuthLogListResponse, type SearchParams } from "@/api/services/auth-log";

const { RangePicker } = DatePicker;

export default function AuthLogPage() {
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
			CREATED: { color: "processing", text: "생성" },
			APPROVED: { color: "success", text: "승인" },
			DENIED: { color: "error", text: "거절" },
			EXPIRED: { color: "warning", text: "만료" },
			BLOCKED: { color: "error", text: "차단" },
			PENDING: { color: "processing", text: "대기" },
			CONSUMED: { color: "default", text: "사용됨" },
		};
		const statusInfo = statusMap[status] || { color: "default", text: status };
		return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
	};

	const columns: ColumnsType<AuthLog> = [
		{
			title: "시간",
			dataIndex: "createdAt",
			width: 180,
			render: (timestamp) => dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss"),
			sorter: true,
		},
		{
			title: "사용자",
			dataIndex: "maskedUser",
			width: 200,
			render: (text) => <code className="text-sm">{text || "-"}</code>,
		},
		{
			title: "App",
			dataIndex: "appName",
			width: 150,
		},
		{
			title: "상태",
			dataIndex: "status",
			width: 100,
			render: (status) => getStatusTag(status),
		},
		{
			title: "국가 / IP",
			width: 200,
			render: (_, record) => (
				<Space direction="vertical" size="small">
					{record.country && <Tag>{record.country}</Tag>}
					<code className="text-xs">{record.requestIp || "-"}</code>
				</Space>
			),
		},
		{
			title: "디바이스",
			width: 180,
			render: (_, record) => {
				const getDeviceTypeLabel = (dt: string) => {
					const map: Record<string, string> = { PC: "PC", Mobile: "모바일", App: "앱" };
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
									{record.devicePlatform === "email" ? "이메일" : record.devicePlatform.toUpperCase()}
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
			title: "작업",
			key: "operation",
			width: 100,
			render: (_, record) => (
				<Button
					type="link"
					onClick={() => navigate(`/auth-log/${record.id}`)}
				>
					상세
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
							<Form.Item name="status" label="상태">
								<Select allowClear placeholder="전체">
									<Select.Option value="CREATED">생성</Select.Option>
									<Select.Option value="APPROVED">승인</Select.Option>
									<Select.Option value="DENIED">거절</Select.Option>
									<Select.Option value="EXPIRED">만료</Select.Option>
									<Select.Option value="BLOCKED">차단</Select.Option>
									<Select.Option value="PENDING">대기</Select.Option>
									<Select.Option value="CONSUMED">사용됨</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<Form.Item name="country" label="국가">
								<Input placeholder="국가 코드 (예: KR)" />
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<Form.Item name="request_ip" label="IP 주소">
								<Input placeholder="IP 주소 검색" />
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<Form.Item name="dateRange" label="기간">
								<RangePicker style={{ width: "100%" }} />
							</Form.Item>
						</Col>
						<Col span={24}>
							<Space>
								<Button onClick={onReset}>초기화</Button>
								<Button type="primary" htmlType="submit">
									검색
								</Button>
							</Space>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card title="인증 로그">
				{isError && (
					<div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-red-700">
						{(error as Error)?.message ?? "목록을 불러오는 중 오류가 발생했습니다."}
					</div>
				)}
				<Table
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={isLoading}
					columns={columns}
					dataSource={list}
					locale={{ emptyText: isLoading ? "로딩 중..." : "데이터가 없습니다." }}
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

