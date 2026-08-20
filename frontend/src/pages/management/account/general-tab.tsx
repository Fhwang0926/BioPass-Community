import { Button, Col, Form, Input, Row, Space, Tag, Typography } from "antd";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/card";
import userStore, { useUserInfo } from "@/store/userStore";
import { toast } from "sonner";
import userService from "@/api/services/user";
import i18n, { t } from "@/locales/i18n";
import { formatDateTime } from "@/locales/locale-meta";

type FieldType = {
	name?: string;
	email?: string;
	phone?: string;
};

export default function GeneralTab() {
	const { id: userId } = useUserInfo();
	const [form] = Form.useForm();
	const queryClient = useQueryClient();

	// 프로필 데이터 조회
	const { data: profileData, isLoading } = useQuery({
		queryKey: ['profile'],
		queryFn: () => userService.getProfile(),
	});

	// 프로필 데이터가 로드되면 폼에 설정
	useEffect(() => {
		if (profileData) {
			form.setFieldsValue({
				name: profileData.name,
				email: profileData.email,
				phone: profileData.phone,
			});
		}
	}, [profileData, form]);

	// 프로필 업데이트
	const handleSubmit = async (values: FieldType) => {
		try {
			await userService.updateProfile({
				name: values.name,
				phone: values.phone,
			});
			await queryClient.invalidateQueries({ queryKey: ['profile'] });
			toast.success(t('sys.menu.account.general.profile_updated'));
		} catch (error) {
			toast.error(t('sys.menu.account.general.profile_update_failed'));
		}
	};

	// 유저 삭제
	const handleDeleteUser = async () => {
		if (!userId) return;
		if (!window.confirm(t('sys.menu.account.general.delete_confirm'))) return;
		try {
			await userService.deleteProfile(Number(userId));
			toast.success(t('sys.menu.account.general.delete_success'));
			// 로그아웃 또는 메인으로 이동
			userStore.getState().actions.clearUserInfoAndToken();
			window.location.href = "/login";
		} catch (e: any) {
			toast.error(e?.message || t('sys.menu.account.general.delete_error'));
		}
	};

	return (
		<Card className="!block w-full">
			<Form
				form={form}
				layout="vertical"
				onFinish={handleSubmit}
				className="w-full"
			>
				<Row gutter={[24, 8]}>
					<Col span={24} md={12}>
						<Form.Item<FieldType>
							label={t('sys.menu.account.general.name')}
							name="name"
							rules={[{ required: true, message: t('sys.menu.account.general.name_required') }]}
						>
							<Input />
						</Form.Item>
					</Col>
					<Col span={24} md={12}>
						<Form.Item<FieldType>
							label={
								<Space size={6} align="center">
									<span>{t('sys.menu.account.general.email')}</span>
									<Tag className="!m-0" color={profileData?.is_verify ? "success" : "warning"}>
										{profileData?.is_verify ? t('sys.menu.account.general.verified') : t('sys.menu.account.general.unverified')}
									</Tag>
								</Space>
							}
							name="email"
						>
							<Input disabled />
						</Form.Item>
					</Col>
					<Col span={24} md={12}>
						<Form.Item<FieldType>
							className="!mb-1"
							label={t('sys.menu.account.general.phone')}
							name="phone"
							tooltip={t('sys.menu.account.general.phone_sha512_hint')}
						>
							<Input placeholder="010-0000-0000" />
						</Form.Item>
						<Typography.Text type="secondary" className="block text-xs leading-5">
							{t('sys.menu.account.general.phone_sha512_hint')}
						</Typography.Text>
					</Col>
				</Row>

				<div className="mt-8 border-t pt-5">
					<Typography.Text strong>{t('sys.menu.account.general.recent_login')}</Typography.Text>
					<div className="mt-1 text-gray-500">
						{profileData?.last_visited_at
							? formatDateTime(profileData.last_visited_at, i18n.resolvedLanguage, {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
								hour: '2-digit',
								minute: '2-digit'
							})
							: t('sys.menu.account.general.no_login_history')}
					</div>
				</div>

				<div className="mt-8 flex w-full flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
					<Button danger onClick={handleDeleteUser}>
						{t('sys.menu.account.general.delete_user')}
					</Button>
					<Button
						type="primary"
						htmlType="submit"
						loading={isLoading}
					>
						{t('sys.menu.account.general.save')}
					</Button>
				</div>
			</Form>
		</Card>
	);
}
