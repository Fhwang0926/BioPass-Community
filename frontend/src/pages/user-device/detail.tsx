import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import {
	Button,
	Card,
	Space,
	Tag,
	Table,
	Descriptions,
	Popconfirm,
	Modal,
	Form,
	DatePicker,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { toast } from "sonner";
import dayjs from "@/utils/dayjs";

import { Iconify } from "@/components/icon";
import userDeviceService from "@/api/services/user-device";

export default function UserDeviceDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [blockModalVisible, setBlockModalVisible] = useState(false);
	const [blockForm] = Form.useForm();

	const { data, isLoading, isError, error, refetch } = useQuery({
		queryKey: ["user-device", id],
		queryFn: () => userDeviceService.getUser(id || ''),
		enabled: !!id,
	});

	// apiClient가 이미 res.data(내부 데이터)로 반환하므로 data가 곧 사용자 상세 객체
	const user = data;

	const handleLogoutAll = async () => {
		if (!id) return;
		try {
			await userDeviceService.logoutAllDevices(id);
			toast.success("모든 디바이스가 로그아웃되었습니다.");
			refetch();
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error("로그아웃에 실패했습니다.");
		}
	};

	const handleBlock = async (values: any) => {
		if (!id) return;
		try {
			await userDeviceService.blockUser(id, values.block_until);
			toast.success("사용자가 차단되었습니다.");
			setBlockModalVisible(false);
			blockForm.resetFields();
			refetch();
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error("차단에 실패했습니다.");
		}
	};

	const handleUnblock = async () => {
		if (!id) return;
		try {
			await userDeviceService.unblockUser(id);
			toast.success("차단이 해제되었습니다.");
			refetch();
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error("차단 해제에 실패했습니다.");
		}
	};

	if (isLoading) {
		return <div>로딩 중...</div>;
	}

	if (isError || !user) {
		return (
			<div className="flex flex-col items-center gap-4 py-8">
				<p className="text-muted-foreground">
					{isError && (error as any)?.response?.status === 404
						? "해당 사용자를 찾을 수 없습니다."
						: "사용자를 불러오지 못했습니다."}
				</p>
				<Button type="primary" onClick={() => navigate("..")}>
					목록으로
				</Button>
			</div>
		);
	}

	const deviceColumns: ColumnsType<any> = [
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
			title: "마지막 활동",
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
	];

	const authHistoryColumns: ColumnsType<any> = [
		{
			title: "시간",
			dataIndex: "createdAt",
			width: 180,
			render: (timestamp) => dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss"),
		},
		{
			title: "상태",
			dataIndex: "status",
			width: 100,
			render: (status) => {
				const statusMap: Record<string, { color: string; text: string }> = {
					APPROVED: { color: "success", text: "승인" },
					DENIED: { color: "error", text: "거절" },
					EXPIRED: { color: "warning", text: "만료" },
					BLOCKED: { color: "error", text: "차단" },
				};
				const statusInfo = statusMap[status] || { color: "default", text: status };
				return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
			},
		},
		{
			title: "IP",
			dataIndex: "requestIp",
			width: 150,
		},
		{
			title: "국가",
			dataIndex: "country",
			width: 100,
			render: (country) => country ? <Tag>{country}</Tag> : "-",
		},
	];

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Space>
					<Button onClick={() => navigate("..")}>
						<Iconify icon="solar:arrow-left-bold" size={18} className="mr-2" />
						목록으로
					</Button>
				</Space>
			</Card>

			{/* 사용자 정보 */}
			<Card
				title="사용자 정보"
				extra={
					<Space>
						{user.status === 'BLOCKED' ? (
							<Button onClick={handleUnblock}>
								차단 해제
							</Button>
						) : (
							<Button danger onClick={() => setBlockModalVisible(true)}>
								인증 일시 차단
							</Button>
						)}
						<Popconfirm
							title="모든 디바이스 로그아웃"
							description="정말 모든 디바이스를 로그아웃하시겠습니까?"
							onConfirm={handleLogoutAll}
							okText="예"
							cancelText="아니오"
						>
							<Button danger>
								모든 디바이스 로그아웃
							</Button>
						</Popconfirm>
					</Space>
				}
			>
				<Descriptions column={2} bordered>
					<Descriptions.Item label="식별자 (이메일/연락처)">
						{user.identifier ?? user.identifierValue ?? '-'}
					</Descriptions.Item>
					<Descriptions.Item label="식별자 타입">
						<Tag>{user.identifierType === 'email' ? '이메일' : '전화번호'}</Tag>
					</Descriptions.Item>
					<Descriptions.Item label="식별자 해시">
						<code>{user.identifierHash}</code>
					</Descriptions.Item>
					<Descriptions.Item label="상태">
						<Tag color={user.status === 'ACTIVE' ? 'success' : user.status === 'BLOCKED' ? 'error' : 'warning'}>
							{user.status === 'ACTIVE' ? '정상' : user.status === 'BLOCKED' ? '제한' : '일시정지'}
						</Tag>
					</Descriptions.Item>
					<Descriptions.Item label="마지막 로그인">
						{user.lastLoginAt ? dayjs(user.lastLoginAt).format("YYYY-MM-DD HH:mm:ss") : "-"}
					</Descriptions.Item>
				</Descriptions>
			</Card>

			{/* 연결된 디바이스 */}
			<Card title="연결된 디바이스">
				<Table
					rowKey="id"
					size="small"
					columns={deviceColumns}
					dataSource={user.devices || []}
					pagination={false}
				/>
			</Card>

			{/* 인증 히스토리 */}
			<Card title="인증 히스토리">
				<Table
					rowKey="id"
					size="small"
					columns={authHistoryColumns}
					dataSource={user.authHistory || []}
					pagination={{
						pageSize: 10,
						showSizeChanger: false,
					}}
				/>
			</Card>

			{/* 차단 모달 */}
			<Modal
				title="인증 일시 차단"
				open={blockModalVisible}
				onOk={() => blockForm.submit()}
				onCancel={() => {
					setBlockModalVisible(false);
					blockForm.resetFields();
				}}
			>
				<Form
					form={blockForm}
					layout="vertical"
					onFinish={handleBlock}
				>
					<Form.Item
						name="block_until"
						label="차단 해제 일시 (선택)"
						tooltip="지정하지 않으면 수동으로 해제할 때까지 차단됩니다."
					>
						<DatePicker
							showTime
							format="YYYY-MM-DD HH:mm:ss"
							style={{ width: "100%" }}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</Space>
	);
}

