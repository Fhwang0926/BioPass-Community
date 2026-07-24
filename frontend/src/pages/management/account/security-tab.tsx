import { Button, Form, Input } from "antd";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import Card from "@/components/card";
import { toast } from "sonner";
import userService from "@/api/services/user";
import { t } from "@/locales/i18n";
import { hashClientPassword } from "@/utils/passwordHash";

type FieldType = {
	password?: string;
	password_new?: string;
	password_confirm?: string;
};

export default function SecurityTab() {
	const [form] = Form.useForm();
	const queryClient = useQueryClient();
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (values: FieldType) => {
		try {
			setIsLoading(true);
			await userService.updateProfile({
				password: hashClientPassword(values.password || ""),
				password_new: hashClientPassword(values.password_new || "")
			});
			
			await queryClient.invalidateQueries({ queryKey: ['profile'] });
			toast.success(t('sys.menu.account.security.change_success'));
			form.resetFields();
		} catch (error) {
			console.log(error);
			toast.error(t('sys.menu.account.security.change_error'));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="!h-auto flex-col">
			<Form
				form={form}
				layout="vertical"
				onFinish={handleSubmit}
				className="w-full"
			>
				<Form.Item<FieldType>
					label={t('sys.menu.account.security.current_password')}
					name="password"
					rules={[
						{ required: true, message: t('sys.menu.account.security.current_password_required') }
					]}
				>
					<Input.Password placeholder={t('sys.menu.account.security.current_password_placeholder')} />
				</Form.Item>

				<Form.Item<FieldType>
					label={t('sys.menu.account.security.new_password')}
					name="password_new"
					rules={[
						{ required: true, message: t('sys.menu.account.security.new_password_required') },
						{ min: 8, message: t('sys.menu.account.security.new_password_min') },
						{ 
							pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
							message: t('sys.menu.account.security.new_password_pattern')
						}
					]}
				>
					<Input.Password placeholder={t('sys.menu.account.security.new_password_placeholder')} />
				</Form.Item>

				<Form.Item<FieldType>
					label={t('sys.menu.account.security.password_confirm')}
					name="password_confirm"
					dependencies={['password_new']}
					rules={[
						{ required: true, message: t('sys.menu.account.security.password_confirm_required') },
						({ getFieldValue }) => ({
							validator(_, value) {
								if (!value || getFieldValue('password_new') === value) {
									return Promise.resolve();
								}
								return Promise.reject(new Error(t('sys.menu.account.security.password_mismatch')));
							},
						}),
					]}
				>
					<Input.Password placeholder={t('sys.menu.account.security.password_confirm_placeholder')} />
				</Form.Item>

				<div className="flex w-full justify-end">
					<Button 
						type="primary" 
						htmlType="submit"
						loading={isLoading}
					>
						{t('sys.menu.account.security.change_password')}
					</Button>
				</div>
			</Form>
		</Card>
	);
}
