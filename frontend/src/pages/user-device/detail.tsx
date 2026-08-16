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
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";
import userDeviceService from "@/api/services/user-device";

export default function UserDeviceDetailPage() {
	const { t } = useTranslation();
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
			toast.success(t("sys.page.userDevice.logoutAllSuccess"));
			refetch();
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error(t("sys.page.userDevice.logoutError"));
		}
	};

	const handleBlock = async (values: any) => {
		if (!id) return;
		try {
			await userDeviceService.blockUser(id, values.block_until);
			toast.success(t("sys.page.userDevice.blockSuccess"));
			setBlockModalVisible(false);
			blockForm.resetFields();
			refetch();
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error(t("sys.page.userDevice.blockError"));
		}
	};

	const handleUnblock = async () => {
		if (!id) return;
		try {
			await userDeviceService.unblockUser(id);
			toast.success(t("sys.page.userDevice.unblockSuccess"));
			refetch();
			queryClient.invalidateQueries({ queryKey: ["user-device"] });
		} catch (error) {
			toast.error(t("sys.page.userDevice.unblockError"));
		}
	};

	if (isLoading) {
		return <div>{t("common.loadingText")}</div>;
	}

	if (isError || !user) {
		return (
			<div className="flex flex-col items-center gap-4 py-8">
				<p className="text-muted-foreground">
					{isError && (error as any)?.response?.status === 404
						? t("sys.page.userDevice.notFound")
						: t("sys.page.userDevice.loadError")}
				</p>
				<Button type="primary" onClick={() => navigate("..")}>
					{t("sys.menu.application.detailPage.back_to_list")}
				</Button>
			</div>
		);
	}

	const deviceColumns: ColumnsType<any> = [
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
	];

	const authHistoryColumns: ColumnsType<any> = [
		{
			title: t("sys.page.authLog.time"),
			dataIndex: "createdAt",
			width: 180,
			render: (timestamp) => dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss"),
		},
		{
			title: t("common.statusText"),
			dataIndex: "status",
			width: 100,
			render: (status) => {
				const statusMap: Record<string, { color: string; text: string }> = {
					APPROVED: { color: "success", text: t("sys.page.authLog.status.approved") },
					DENIED: { color: "error", text: t("sys.page.authLog.status.denied") },
					EXPIRED: { color: "warning", text: t("sys.page.authLog.status.expired") },
					BLOCKED: { color: "error", text: t("sys.page.authLog.status.blocked") },
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
			title: t("sys.page.authLog.country"),
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
						{t("sys.menu.application.detailPage.back_to_list")}
					</Button>
				</Space>
			</Card>

			{/* 사용자 정보 */}
			<Card
				title={t("sys.page.userDevice.userInfo")}
				extra={
					<Space>
						{user.status === 'BLOCKED' ? (
							<Button onClick={handleUnblock}>
								{t("sys.page.userDevice.unblock")}
							</Button>
						) : (
							<Button danger onClick={() => setBlockModalVisible(true)}>
								{t("sys.page.userDevice.blockTemporarily")}
							</Button>
						)}
						<Popconfirm
							title={t("sys.page.userDevice.logoutAll")}
							description={t("sys.page.userDevice.logoutAllDesc")}
							onConfirm={handleLogoutAll}
							okText={t("common.yes")}
							cancelText={t("common.no")}
						>
							<Button danger>
								{t("sys.page.userDevice.logoutAll")}
							</Button>
						</Popconfirm>
					</Space>
				}
			>
				<Descriptions column={2} bordered>
					<Descriptions.Item label={t("sys.page.userDevice.identifier")}>
						{user.identifier ?? user.identifierValue ?? '-'}
					</Descriptions.Item>
					<Descriptions.Item label={t("sys.page.userDevice.identifierType")}>
						<Tag>{user.identifierType === 'email' ? t("sys.page.userDevice.email") : t("sys.page.userDevice.phone")}</Tag>
					</Descriptions.Item>
					<Descriptions.Item label={t("sys.page.userDevice.identifierHash")}>
						<code>{user.identifierHash}</code>
					</Descriptions.Item>
					<Descriptions.Item label={t("common.statusText")}>
						<Tag color={user.status === 'ACTIVE' ? 'success' : user.status === 'BLOCKED' ? 'error' : 'warning'}>
							{user.status === 'ACTIVE' ? t("sys.page.userDevice.normal") : user.status === 'BLOCKED' ? t("sys.page.userDevice.blocked") : t("sys.page.userDevice.suspended")}
						</Tag>
					</Descriptions.Item>
					<Descriptions.Item label={t("sys.page.userDevice.lastLogin")}>
						{user.lastLoginAt ? dayjs(user.lastLoginAt).format("YYYY-MM-DD HH:mm:ss") : "-"}
					</Descriptions.Item>
				</Descriptions>
			</Card>

			{/* 연결된 디바이스 */}
			<Card title={t("sys.page.userDevice.connectedDevices")}>
				<Table
					rowKey="id"
					size="small"
					columns={deviceColumns}
					dataSource={user.devices || []}
					pagination={false}
				/>
			</Card>

			{/* 인증 히스토리 */}
			<Card title={t("sys.page.userDevice.authHistory")}>
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
				title={t("sys.page.userDevice.blockTemporarily")}
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
						label={t("sys.page.userDevice.blockUntil")}
						tooltip={t("sys.page.userDevice.blockUntilHint")}
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

