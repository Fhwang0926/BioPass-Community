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

import userDeviceService, { type Device, type DeviceSearchParams } from "@/api/services/user-device";

export default function DeviceManagementPage() {
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
			toast.success("디바이스가 해제되었습니다.");
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error("디바이스 해제에 실패했습니다.");
		}
	};

	const columns: ColumnsType<Device> = [
		{
			title: "플랫폼",
			dataIndex: "platform",
			width: 100,
			render: (platform) => (
				<Tag color={platform === 'ios' ? 'blue' : 'green'}>
					{platform ? String(platform).toUpperCase() : '-'}
				</Tag>
			),
		},
		{
			title: "디바이스 이름",
			dataIndex: "deviceName",
			width: 200,
		},
		{
			title: "사용자",
			dataIndex: "user",
			width: 220,
			render: (user) => user ? (
				<Space>
					<Tag>{user.identifierType === 'email' ? '이메일' : '전화번호'}</Tag>
					<span>{user.identifierValue ?? user.identifierHash ?? '-'}</span>
				</Space>
			) : "-",
		},
		{
			title: "마지막 활동 시간",
			dataIndex: "lastSeenAt",
			width: 180,
			render: (timestamp) => timestamp ? dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss") : "-",
		},
		{
			title: "Trusted",
			dataIndex: "isTrusted",
			width: 100,
			render: (isTrusted) => (
				<Tag color={isTrusted ? "success" : "default"}>
					{isTrusted ? "예" : "아니오"}
				</Tag>
			),
		},
		{
			title: "상태",
			dataIndex: "isRevoked",
			width: 100,
			render: (isRevoked) => (
				<Tag color={isRevoked ? "error" : "success"}>
					{isRevoked ? "해제됨" : "활성"}
				</Tag>
			),
		},
		{
			title: "작업",
			key: "operation",
			width: 120,
			render: (_, record) => (
				!record.isRevoked && (
					<Popconfirm
						title="디바이스 강제 해제"
						description="정말 이 디바이스를 해제하시겠습니까? (기기 분실 대응)"
						onConfirm={() => handleRevoke(record.id)}
						okText="예"
						cancelText="아니오"
					>
						<Button danger size="small">
							강제 해제
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
							<Form.Item name="platform" label="플랫폼">
								<Select allowClear placeholder="전체">
									<Select.Option value="ios">iOS</Select.Option>
									<Select.Option value="android">Android</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={8}>
							<Form.Item name="revoked" label="상태">
								<Select allowClear placeholder="전체">
									<Select.Option value={false}>활성</Select.Option>
									<Select.Option value={true}>해제됨</Select.Option>
								</Select>
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

			<Card title="디바이스 관리">
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

