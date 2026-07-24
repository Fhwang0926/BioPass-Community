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

import userDeviceService, { type User, type UserSearchParams } from "@/api/services/user-device";

export default function UserDevicePage() {
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
			title: "식별자",
			key: "identifier",
			width: 220,
			render: (_, record) => (
				<Space>
					<Tag>{record.identifierType === 'email' ? '이메일' : '전화번호'}</Tag>
					<span>{record.identifier ?? record.identifierValue ?? record.identifierHash ?? '-'}</span>
				</Space>
			),
		},
		{
			title: "등록 디바이스 수",
			dataIndex: "deviceCount",
			width: 120,
			render: (count) => <Tag color="blue">{count || 0}개</Tag>,
		},
		{
			title: "마지막 로그인",
			dataIndex: "lastLoginAt",
			width: 180,
			render: (timestamp) => timestamp ? dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss") : "-",
		},
		{
			title: "상태",
			dataIndex: "status",
			width: 100,
			render: (status) => (
				<Tag color={status === 'ACTIVE' ? 'success' : status === 'BLOCKED' ? 'error' : 'warning'}>
					{status === 'ACTIVE' ? '정상' : status === 'BLOCKED' ? '제한' : '일시정지'}
				</Tag>
			),
		},
		{
			title: "작업",
			key: "operation",
			width: 120,
			render: (_, record) => (
				<Button
					type="link"
					onClick={() => navigate(record.id, { relative: 'path' })}
				>
					상세
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
							<Form.Item name="status" label="상태">
								<Select allowClear placeholder="전체">
									<Select.Option value="ACTIVE">정상</Select.Option>
									<Select.Option value="BLOCKED">제한</Select.Option>
									<Select.Option value="SUSPENDED">일시정지</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={8}>
							<Form.Item name="identifier_type" label="식별자 타입">
								<Select allowClear placeholder="전체">
									<Select.Option value="email">이메일</Select.Option>
									<Select.Option value="phone">전화번호</Select.Option>
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

			<Card
				title="사용자 목록"
				extra={
					<Button onClick={() => navigate("/user-management/devices")}>
						디바이스 관리
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

