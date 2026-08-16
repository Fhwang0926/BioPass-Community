import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
	Button,
	Card,
	Col,
	Form,
	Row,
	Select,
	Space,
	Table,
	Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import dayjs from "@/utils/dayjs";
import { useTranslation } from "react-i18next";

import userDeviceService, { type User, type UserSearchParams } from "@/api/services/user-device";

export default function UserDevicePage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [searchForm] = Form.useForm();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 20,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<UserSearchParams>({ option: {} });

	const columns: ColumnsType<User> = [
		{
			title: t("sys.page.userDevice.identifier"),
			key: "identifier",
			width: 220,
			render: (_, record) => (
				<Space>
					<Tag>{record.identifierType === 'email' ? t("sys.page.userDevice.email") : t("sys.page.userDevice.phone")}</Tag>
					<span>{record.identifier ?? record.identifierValue ?? record.identifierHash ?? '-'}</span>
				</Space>
			),
		},
		{
			title: t("sys.page.userDevice.registeredDeviceCount"),
			dataIndex: "deviceCount",
			width: 120,
			render: (count) => <Tag color="blue">{count || 0}{t("common.countUnit")}</Tag>,
		},
		{
			title: t("sys.page.userDevice.lastLogin"),
			dataIndex: "lastLoginAt",
			width: 180,
			render: (timestamp) => timestamp ? dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss") : "-",
		},
		{
			title: t("common.statusText"),
			dataIndex: "status",
			width: 100,
			render: (status) => (
				<Tag color={status === 'ACTIVE' ? 'success' : status === 'BLOCKED' ? 'error' : 'warning'}>
					{status === 'ACTIVE' ? t("sys.page.userDevice.normal") : status === 'BLOCKED' ? t("sys.page.userDevice.blocked") : t("sys.page.userDevice.suspended")}
				</Tag>
			),
		},
		{
			title: t("common.actionText"),
			key: "operation",
			width: 120,
			render: (_, record) => (
				<Button
					type="link"
					onClick={() => navigate(record.id, { relative: 'path' })}
				>
					{t("common.detail")}
				</Button>
			),
		},
	];

	const { data, isLoading } = useQuery({
		queryKey: ["user-device", searchParams, pagination],
		queryFn: () => userDeviceService.getUserList({
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
							<Form.Item name="status" label={t("common.statusText")}>
								<Select allowClear placeholder={t("sys.page.userDevice.all")}>
									<Select.Option value="ACTIVE">{t("sys.page.userDevice.normal")}</Select.Option>
									<Select.Option value="BLOCKED">{t("sys.page.userDevice.blocked")}</Select.Option>
									<Select.Option value="SUSPENDED">{t("sys.page.userDevice.suspended")}</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={8}>
							<Form.Item name="identifier_type" label={t("sys.page.userDevice.identifierType")}>
								<Select allowClear placeholder={t("sys.page.userDevice.all")}>
									<Select.Option value="email">{t("sys.page.userDevice.email")}</Select.Option>
									<Select.Option value="phone">{t("sys.page.userDevice.phone")}</Select.Option>
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

			<Card
				title={t("sys.page.userDevice.userList")}
				extra={
					<Button onClick={() => navigate("/user-management/devices")}>
						{t("sys.page.userDevice.deviceManagement")}
					</Button>
				}
			>
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

