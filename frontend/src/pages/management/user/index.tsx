import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Button,
	Card,
	Col,
	Form,
	Input,
	Modal,
	Popconfirm,
	Row,
	Select,
	Space,
	Tag,
	Table,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { IconButton, Iconify } from "@/components/icon";

import type { User, Company } from "#/entity";
import type { SearchParams } from "@/api/services/user";
import userService from "@/api/services/user";
import companyService from "@/api/services/company";
import { t } from "@/locales/i18n";
import { useUserInfo } from "@/store/userStore";

const isSuperAdminUser = (user?: Pick<User, "permissions">) =>
	String(user?.permissions || "").toUpperCase() === "SUPER_ADMIN";

export default function UserPage() {
	const [searchForm] = Form.useForm();
	const queryClient = useQueryClient();
	const userInfo = useUserInfo();
	const currentCompanyId = userInfo.company_id;
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 10,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<SearchParams>(Object.assign({}));
	const [userProps, setUserProps] = useState<UserProps>({
		formValue: {
			id: 0,
			email: "",
			password: "",
			name: "",
			phone: "",
			permissions: "user",
			company_id: currentCompanyId,
			is_active: true,
			is_verify: true,
			is_del: false,
		},
		title: "New",
		show: false,
		onOk: () => {
			setUserProps((prev) => ({ ...prev, show: false }));
		},
		onCancel: () => {
			setUserProps((prev) => ({ ...prev, show: false }));
		},
	});

	const columns: ColumnsType<User> = [
		{ title: t('sys.menu.user.management.email'), dataIndex: "email", width: 200 },
		{ title: t('sys.menu.user.management.name'), dataIndex: "name", width: 150 },
		{
			title: t('sys.menu.user.management.permissions'),
			dataIndex: "permissions",
			width: 120,
			render: (permissions) => {
				const value = String(permissions || '').toUpperCase();
				return (
					<Tag color={
						value === 'ADMIN' || value === 'SUPER_ADMIN' ? 'red' :
						'green'
					}>
						{value || '-'}
					</Tag>
				);
			},
		},
		{
			title: t('sys.menu.user.management.status'),
			dataIndex: "is_active",
			width: 100,
			render: (is_active) => (
				<Tag color={is_active ? "success" : "error"}>
					{is_active ? t('sys.menu.user.management.enable') : t('sys.menu.user.management.disable')}
				</Tag>
			),
		},
		{
			title: t('sys.menu.user.management.action'),
			key: "operation",
			width: 120,
			render: (_, record) => {
				if (isSuperAdminUser(record)) {
					return <Tag color="purple">{t('sys.menu.user.management.db_only')}</Tag>;
				}
				return (
					<Space>
						<IconButton onClick={() => onEdit(record)}>
							<Iconify icon="solar:pen-bold-duotone" size={18} />
						</IconButton>
						<Popconfirm
							title={t('sys.menu.user.management.delete_confirm_title')}
							description={t('sys.menu.user.management.delete_confirm_desc')}
							onConfirm={() => onDelete(record.id)}
							okText={t('sys.menu.user.management.yes')}
							cancelText={t('sys.menu.user.management.no')}
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
				);
			},
		},
	];

	const { data, isLoading } = useQuery({
		queryKey: ["user", currentCompanyId, searchParams, pagination.current, pagination.pageSize],
		queryFn: () => userService.getUserList({
			...searchParams,
			company_id: currentCompanyId,
			option: {
				offset: (pagination.current - 1) * pagination.pageSize,
				limit: pagination.pageSize,
			}
		}),
		enabled: !!currentCompanyId,
	});

	const list = Array.isArray(data?.data) ? data.data : [];

	useEffect(() => {
		if (data?.total != null) {
			setPagination((prev) => (prev.total !== data.total ? { ...prev, total: data.total } : prev));
		}
	}, [data?.total]);

	const onSearch = () => {
		const values = searchForm.getFieldsValue();
		const { searchField = 'email', searchValue = '', ...rest } = values;
		let params: any = { ...rest };
		if (searchField && searchValue !== undefined) {
			params[searchField] = searchValue;
		}
		setSearchParams(params);
		setPagination(prev => ({ ...prev, current: 1 }));
	};

	const onSearchFormReset = () => {
		searchForm.resetFields();
		setSearchParams(Object.assign({}));
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
			await userService.deleteUser(id);
			toast.success(t('sys.menu.user.management.delete_success'));
			queryClient.invalidateQueries({ queryKey: ["user"] });
		} catch (error) {
			toast.error(t('sys.menu.user.management.delete_error'));
		}
	};

	const onCreate = () => {
		if (!currentCompanyId) {
			toast.error(t('sys.menu.user.management.company_not_found'));
			return;
		}
	setUserProps((prev) => ({
		...prev,
		show: true,
		title: t('sys.menu.user.management.email_invite') || "이메일 초대",
		formValue: {
			id: 0,
				email: "",
				password: "",
				name: "",
				phone: "",
				permissions: "user",
				company_id: currentCompanyId,
				is_active: true,
				is_verify: true,
				is_del: false,
			},
		}));
	};

	const onEdit = async (record: UserProps["formValue"]) => {
		if (isSuperAdminUser(record)) {
			toast.warning(t('sys.menu.user.management.db_only'));
			return;
		}
		try {
			// Fetch company information if company_id exists
			if (record.company_id) {
				const rv = await companyService.getCompany(record.company_id);
				setUserProps((prev) => ({
					...prev,
					show: true,
					title: t('sys.menu.user.management.edit'),
					formValue: record,
					selectedCompany: rv,
				}));
			} else {
				setUserProps((prev) => ({
					...prev,
					show: true,
					title: t('sys.menu.user.management.edit'),
					formValue: record,
					selectedCompany: null,
				}));
			}
		} catch (error) {
			toast.error(t('sys.menu.user.management.operation_failed'));
			setUserProps((prev) => ({
				...prev,
				show: true,
				title: t('sys.menu.user.management.edit'),
				formValue: record,
				selectedCompany: null,
			}));
		}
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch}>
					<Row gutter={[16, 16]}>
						<Col span={24} lg={8}>
							<Form.Item
								label={t('sys.menu.user.management.search_field')}
								name="searchField"
								className="!mb-0"
							>
								<Select defaultValue="email"
									onChange={() => {
										searchForm.setFieldValue('searchValue', '');
									}}
								>
									<Select.Option value="email">{t('sys.menu.user.management.email')}</Select.Option>
									<Select.Option value="name">{t('sys.menu.user.management.name')}</Select.Option>
									<Select.Option value="permissions">{t('sys.menu.user.management.permissions')}</Select.Option>
									<Select.Option value="is_active">{t('sys.menu.user.management.status')}</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={10}>
							<Form.Item
								noStyle
								shouldUpdate={(prev, curr) => prev?.searchField !== curr?.searchField}
							>
								{({ getFieldValue }) => {
									const searchField = getFieldValue('searchField');
									
									if (searchField === 'permissions') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Select>
													<Select.Option value="user">{t('sys.menu.user.management.role_user')}</Select.Option>
													<Select.Option value="admin">{t('sys.menu.user.management.role_admin')}</Select.Option>
												</Select>
											</Form.Item>
										);
									}

									if (searchField === 'is_active') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Select>
													<Select.Option value={true}>
														<Tag color="success">{t('sys.menu.user.management.enable')}</Tag>
													</Select.Option>
													<Select.Option value={false}>
														<Tag color="error">{t('sys.menu.user.management.disable')}</Tag>
													</Select.Option>
												</Select>
											</Form.Item>
										);
									}
									
									return (
										<Form.Item
											name="searchValue"
											className="!mb-0"
										>
											<Input placeholder={t('sys.menu.user.management.search_value')} />
										</Form.Item>
									);
								}}
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<div className="flex justify-end">
								<Button onClick={onSearchFormReset}>{t('sys.menu.user.management.reset')}</Button>
								<Button type="primary" className="ml-4" htmlType="submit">
									{t('sys.menu.user.management.search')}
								</Button>
							</div>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card
				title={t('sys.menu.user.management.company_account_title')}
				extra={
					<Button type="primary" onClick={onCreate}>
						{t('sys.menu.user.management.email_invite')}
					</Button>
				}
			>
				<div className="mb-4 text-sm text-gray">
					{t('sys.menu.user.management.company_account_desc')}
				</div>
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
						total: Number(data?.total ?? 0),
						showSizeChanger: true,
						showQuickJumper: true,
					}}
					onChange={handleTableChange}
				/>
			</Card>

			<UserForm {...userProps} />
		</Space>
	);
}

type UserProps = {
	formValue: UserFormValue;
	title: string;
	show: boolean;
	selectedCompany?: Company | null;
	onOk: VoidFunction;
	onCancel: VoidFunction;
};

type UserFormValue = Omit<User, "is_admin">;

function UserForm({
	title,
	show,
	formValue,
	selectedCompany: initialSelectedCompany,
	onOk,
	onCancel,
}: UserProps) {
	const [form] = Form.useForm();
	const queryClient = useQueryClient();
	const [selectedCompany, setSelectedCompany] = useState<Company | null>(initialSelectedCompany || null);

	// Fetch current company information for the fixed invite scope.
	const { data: currentCompanyData } = useQuery({
		queryKey: ["company", formValue.company_id],
		queryFn: () => companyService.getCompany(formValue.company_id!),
		enabled: show && !!formValue.company_id && !initialSelectedCompany,
	});

	// Update selectedCompany when initialSelectedCompany or currentCompanyData changes
	useEffect(() => {
		if (initialSelectedCompany) {
			setSelectedCompany(initialSelectedCompany);
		} else if (currentCompanyData) {
			setSelectedCompany(currentCompanyData);
		}
	}, [initialSelectedCompany, currentCompanyData]);

	useEffect(() => {
		if (show) {
			form.resetFields();
			form.setFieldsValue(formValue);
			setSelectedCompany(initialSelectedCompany || currentCompanyData || null);
		}
	}, [show, formValue, form, initialSelectedCompany, currentCompanyData]);

	const handleSubmit = async (values: any) => {
		const companyId = formValue.company_id || selectedCompany?.id;
		if (!companyId) {
			toast.error(t('sys.menu.user.management.please_select_company'));
			return;
		}

		try {
			const payload = {
				...values,
				company_id: companyId,
			};
			if (formValue.id) {
				await userService.updateUser({ ...payload, id: formValue.id });
				toast.success(t('sys.menu.user.management.update_success'));
			} else {
				const result = await userService.inviteUser(payload);
				if (result.invitation.email_sent) {
					toast.success(t('sys.menu.user.management.invite_success') || "초대 메일을 발송했습니다.");
				} else {
					toast.warning(t('sys.menu.user.management.invite_mail_failed') || "계정은 생성됐지만 메일 발송은 실패했습니다. 관리자에게 비밀번호 재설정을 요청하세요.");
				}
			}
			queryClient.invalidateQueries({ queryKey: ["user"] });
			onOk();
		} catch (error: any) {
			toast.error(error?.message || t('sys.menu.user.management.operation_failed'));
		}
	};

	const selectedCompanyActive = selectedCompany
		? selectedCompany.is_active ?? (selectedCompany as any).isActive ?? true
		: false;

	return (
		<>
			<Modal 
				title={title} 
				open={show} 
				onOk={form.submit} 
				onCancel={onCancel}
				width={600}
				destroyOnClose
				zIndex={1000}
			>
				<Form
					form={form}
					layout="vertical"
					onFinish={handleSubmit}
					initialValues={formValue}
					preserve={false}
				>
					<Form.Item
						label={t('sys.menu.user.management.email')}
						name="email"
							rules={[
								{ required: true, message: t('sys.login.emaildPlaceholder') },
								{ type: "email", message: t('sys.menu.user.management.email_invalid') }
							]}
						>
						<Input />
					</Form.Item>
					<Form.Item
						label={t('sys.menu.user.management.name')}
						name="name"
					>
						<Input />
					</Form.Item>
					<Form.Item
						label={t('sys.menu.user.management.phone')}
						name="phone"
						tooltip={t('sys.menu.account.general.phone_sha512_hint')}
					>
						<Input placeholder="010-0000-0000" />
					</Form.Item>
					<Form.Item
							label={t('sys.menu.user.management.permissions')}
							name="permissions"
							rules={[{ required: true, message: t('sys.menu.user.management.permissions_required') }]}
						>
							<Select>
								<Select.Option value="user">{t('sys.menu.user.management.role_user')}</Select.Option>
								<Select.Option value="admin">{t('sys.menu.user.management.role_admin')}</Select.Option>
							</Select>
						</Form.Item>
					<Form.Item
						name="company_id"
						hidden
					>
						<Input />
					</Form.Item>
						<Form.Item label={t('sys.menu.user.management.company_name')}>
							<Input
								value={selectedCompany?.name || (formValue.company_id && formValue.company_id > 0 ? t('sys.menu.user.management.loading') : '')}
								readOnly
							/>
					</Form.Item>
					{selectedCompany && (
						<div className="mb-4 p-4 bg-gray-50 rounded">
							<Space direction="vertical" size="small" className="w-full">
								<div className="flex items-center">
									<span className="font-medium mr-2">{t('sys.menu.user.management.company_name')}:</span>
									<span>{selectedCompany.name}</span>
								</div>
								<div className="flex items-center">
									<span className="font-medium mr-2">{t('sys.menu.user.management.email')}:</span>
									<span>{selectedCompany.email}</span>
								</div>
								<div className="flex items-center">
									<span className="font-medium mr-2">{t('sys.menu.user.management.status')}:</span>
									<Tag color={selectedCompanyActive ? "success" : "error"}>
										{selectedCompanyActive ? t('sys.menu.user.management.active') : t('sys.menu.user.management.inactive')}
									</Tag>
								</div>
							</Space>
						</div>
					)}
				</Form>
			</Modal>

		</>
	);
}
