import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Button,
	Card,
	Col,
	Form,
	Popconfirm,
	Row,
	Select,
	Space,
	Table,
	Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { toast } from "sonner";
import dayjs from "@/utils/dayjs";
import { useTranslation } from "react-i18next";

import userDeviceService, { type Device, type DeviceSearchParams } from "@/api/services/user-device";

export default function DeviceManagementPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [searchForm] = Form.useForm();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 20,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<DeviceSearchParams>({ option: {} });

	const handleRevoke = async (deviceId: string) => {
		try {
			await userDeviceService.revokeDevice(deviceId);
			toast.success(t("sys.page.userDevice.revokeSuccess"));
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error(t("sys.page.userDevice.revokeError"));
		}
	};

	const columns: ColumnsType<Device> = [
		{
			title: t("sys.page.userDevice.platform"),
			dataIndex: "platform",
			width: 100,
			render: (platform) => (
				<Tag color={platform === 'ios' ? 'blue' : 'green'}>
					{platform ? String(platform).toUpperCase() : '-'}
				</Tag>
			),
		},
		{
			title: t("sys.page.userDevice.deviceName"),
			dataIndex: "deviceName",
			width: 200,
		},
		{
			title: t("sys.page.userDevice.user"),
			dataIndex: "user",
			width: 220,
			render: (user) => user ? (
				<Space>
					<Tag>{user.identifierType === 'email' ? t("sys.page.userDevice.email") : t("sys.page.userDevice.phone")}</Tag>
					<span>{user.identifierValue ?? user.identifierHash ?? '-'}</span>
				</Space>
			) : "-",
		},
		{
			title: t("sys.page.userDevice.lastActivity"),
			dataIndex: "lastSeenAt",
			width: 180,
			render: (timestamp) => timestamp ? dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss") : "-",
		},
		{
			title: t("sys.page.userDevice.trusted"),
			dataIndex: "isTrusted",
			width: 100,
			render: (isTrusted) => (
				<Tag color={isTrusted ? "success" : "default"}>
					{isTrusted ? t("common.yes") : t("common.no")}
				</Tag>
			),
		},
		{
			title: t("common.statusText"),
			dataIndex: "isRevoked",
			width: 100,
			render: (isRevoked) => (
				<Tag color={isRevoked ? "error" : "success"}>
					{isRevoked ? t("sys.page.userDevice.revoked") : t("common.active")}
				</Tag>
			),
		},
		{
			title: t("common.actionText"),
			key: "operation",
			width: 120,
			render: (_, record) => (
				!record.isRevoked && (
					<Popconfirm
						title={t("sys.page.userDevice.forceRevoke")}
						description={t("sys.page.userDevice.forceRevokeDesc")}
						onConfirm={() => handleRevoke(record.id)}
						okText={t("common.yes")}
						cancelText={t("common.no")}
					>
						<Button danger size="small">
							{t("sys.page.userDevice.forceRevoke")}
						</Button>
					</Popconfirm>
				)
			),
		},
	];

	const { data, isLoading } = useQuery({
		queryKey: ["devices", searchParams, pagination],
		queryFn: () => userDeviceService.getDeviceList({
			...searchParams,
			page: pagination.current,
			limit: pagination.pageSize,
		}),
	});

	const onSearch = () => {
		const values = searchForm.getFieldsValue();
		setSearchParams(values);
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const onReset = () => {
		searchForm.resetFields();
		setSearchParams({ option: {} });
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const handleTableChange = (newPagination: any) => {
		setPagination({
			current: newPagination.current,
			pageSize: newPagination.pageSize,
			total: pagination.total,
		});
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch} layout="inline">
					<Row gutter={[16, 16]} className="w-full">
						<Col span={24} lg={8}>
							<Form.Item name="platform" label={t("sys.page.userDevice.platform")}>
								<Select allowClear placeholder={t("sys.page.userDevice.all")}>
									<Select.Option value="ios">iOS</Select.Option>
									<Select.Option value="android">Android</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={8}>
							<Form.Item name="revoked" label={t("common.statusText")}>
								<Select allowClear placeholder={t("sys.page.userDevice.all")}>
									<Select.Option value={false}>{t("common.active")}</Select.Option>
									<Select.Option value={true}>{t("sys.page.userDevice.revoked")}</Select.Option>
								</Select>
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

			<Card title={t("sys.page.userDevice.deviceManagement")}>
				<Table
					rowKey="id"
					size="small"
					scroll={{ x: "max-content" }}
					loading={isLoading}
					columns={columns}
					dataSource={data?.data ?? []}
					pagination={{
						...pagination,
						total: Number(data?.pagination?.total ?? 0),
						showSizeChanger: true,
						showQuickJumper: true,
					}}
					onChange={handleTableChange}
				/>
			</Card>
		</Space>
	);
}

