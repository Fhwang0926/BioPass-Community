import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
	Button,
	Card,
	Col,
	Form,
	Input,
	Popconfirm,
	Row,
	Select,
	Space,
	Table,
	Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import dayjs from "@/utils/dayjs";

import { IconButton, Iconify } from "@/components/icon";
import { t } from "@/locales/i18n";
import applicationService, { type Application, type ApplicationListResponse, type SearchParams } from "@/api/services/application";

export default function ApplicationPage() {
	const navigate = useNavigate();
	const [searchForm] = Form.useForm();
	const queryClient = useQueryClient();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 20,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<SearchParams>({});

	const columns: ColumnsType<Application> = [
		{ 
			title: "App 이름", 
			dataIndex: "name", 
			width: 200,
			render: (text, record) => (
				<Button 
					type="link" 
					onClick={() => navigate(`/service/application/${record.id}`)}
					className="p-0"
				>
					{text}
				</Button>
			)
		},
		{ title: "Client ID", dataIndex: "clientId", width: 250 },
		{
			title: t("common.statusText", { defaultValue: "상태" }),
			dataIndex: "isActive",
			width: 100,
			render: (isActive) => (
				<Tag color={isActive ? "success" : "error"}>
					{isActive ? t("sys.menu.application.detailPage.active") : t("sys.menu.application.detailPage.inactive")}
				</Tag>
			),
		},
		{
			title: "최근 인증 요청 시간",
			dataIndex: "lastAuthRequestAt",
			width: 180,
			render: (date) => date ? dayjs(date).format("YYYY-MM-DD HH:mm:ss") : "-",
		},
		{
			title: t("common.actionText", { defaultValue: "작업" }),
			key: "operation",
			width: 120,
			render: (_, record) => (
				<Space>
					<IconButton onClick={() => navigate(`/service/application/${record.id}`)}>
						<Iconify icon="solar:eye-bold-duotone" size={18} />
					</IconButton>
					<Popconfirm
						title={t("sys.menu.application.delete_confirm_title")}
						description={t("sys.menu.application.delete_confirm_desc")}
						onConfirm={() => onDelete(record.id)}
						okText={t("common.okText")}
						cancelText={t("common.cancelText")}
					>
						<IconButton>
							<Iconify
								icon="mingcute:delete-2-fill"
								size={18}
								className="text-error"
							/>
						</IconButton>
					</Popconfirm>
				</Space>
			),
		},
	];

	const { data, isLoading } = useQuery({
		queryKey: ["application", searchParams, pagination.current, pagination.pageSize],
		queryFn: () => applicationService.getApplicationList({
			...searchParams,
			page: pagination.current,
			limit: pagination.pageSize,
		}),
	});

	// apiClient가 payload만 반환 → data = { data: Application[], pagination }
	const list: Application[] = Array.isArray(data?.data) ? data.data : [];
	const listPagination = data && typeof data === "object" ? (data as ApplicationListResponse).pagination : undefined;

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
		setSearchParams(values);
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const onSearchFormReset = () => {
		searchForm.resetFields();
		setSearchParams({});
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const handleTableChange = (newPagination: { current?: number; pageSize?: number }) => {
		setPagination((prev) => ({
			...prev,
			current: newPagination.current ?? prev.current,
			pageSize: newPagination.pageSize ?? prev.pageSize,
		}));
	};

	const onDelete = async (id: number) => {
		try {
			await applicationService.deleteApplication(id);
			toast.success(t("sys.menu.application.delete_success"));
			queryClient.invalidateQueries({ queryKey: ["application"] });
		} catch (error) {
			toast.error(t("sys.menu.application.delete_error"));
		}
	};

	const onCreate = () => {
		navigate("/service/application/create");
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch} layout="inline">
					<Row gutter={[16, 16]} className="w-full">
						<Col span={24} lg={8}>
							<Form.Item name="name" label="App 이름">
								<Input placeholder="App 이름 검색" />
							</Form.Item>
						</Col>
						<Col span={24} lg={8}>
							<Form.Item name="client_id" label="Client ID">
								<Input placeholder="Client ID 검색" />
							</Form.Item>
						</Col>
						<Col span={24} lg={8}>
							<Form.Item name="is_active" label={t("common.statusText", { defaultValue: "상태" })}>
								<Select allowClear placeholder={t("common.statusPlaceholder", { defaultValue: "상태 선택" })}>
									<Select.Option value={true}>
										<Tag color="success">{t("sys.menu.application.detailPage.active")}</Tag>
									</Select.Option>
									<Select.Option value={false}>
										<Tag color="error">{t("sys.menu.application.detailPage.inactive")}</Tag>
									</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={24}>
							<Space>
								<Button onClick={onSearchFormReset}>{t("common.resetText")}</Button>
								<Button type="primary" htmlType="submit">
									{t("common.searchText")}
								</Button>
							</Space>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card
				title="애플리케이션 목록"
				extra={
					<Button type="primary" onClick={onCreate}>
						새 애플리케이션
					</Button>
				}
			>
				<Table
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={isLoading}
					columns={columns}
					dataSource={list}
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
