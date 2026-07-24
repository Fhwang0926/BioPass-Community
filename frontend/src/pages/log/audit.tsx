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

import type { LogAuditSearchParams } from "@/api/services/log";
import logService from "@/api/services/log";
import { t } from "@/locales/i18n";

export default function AuditLogPage() {
	const [searchForm] = Form.useForm();
	const queryClient = useQueryClient();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 10,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<LogAuditSearchParams>(Object.assign({}));
	const [auditProps, setAuditProps] = useState<AuditProps>({
		formValue: {
			id: 0,
			user_id: 0,
			action: "",
			status: "success",
			ip_address: "",
			user_agent: "",
			request_data: "",
			response_data: "",
			response_time: 0,
			error_message: "",
		},
		title: "New",
		show: false,
		onOk: () => {
			setAuditProps((prev) => ({ ...prev, show: false }));
		},
		onCancel: () => {
			setAuditProps((prev) => ({ ...prev, show: false }));
		},
	});

	const columns: ColumnsType<any> = [
		{ title: t('sys.menu.log.audit_log.user_id'), dataIndex: "user_id", width: 100 },
		{ title: t('sys.menu.log.audit_log.action'), dataIndex: "action", width: 200 },
		{ 
			title: t('sys.menu.log.audit_log.status'), 
			dataIndex: "status", 
			width: 100,
			render: (status: 'success' | 'error') => {
				const colors: Record<'success' | 'error', string> = {
					success: "success",
					error: "error",
				};
				return (
					<Tag color={colors[status]}>
						{status === 'success' ? t('sys.menu.log.audit_log.status_success') : t('sys.menu.log.audit_log.status_error')}
					</Tag>
				);
			},
		},
		{ title: t('sys.menu.log.audit_log.ip_address'), dataIndex: "ip_address", width: 150 },
		{ title: t('sys.menu.log.audit_log.response_time'), dataIndex: "response_time", width: 120, render: (time) => `${time}ms` },
		{ title: t('sys.menu.log.audit_log.created_at'), dataIndex: "created_at", width: 180 },
		{
			title: t('sys.menu.log.audit_log.action_column'),
			key: "operation",
			width: 120,
			render: (_, record) => (
				<Space>
					<IconButton onClick={() => onView(record)}>
						<Iconify icon="solar:eye-bold-duotone" size={18} />
					</IconButton>
					<Popconfirm
						title={t('sys.menu.log.audit_log.delete_confirm_title')}
						description={t('sys.menu.log.audit_log.delete_confirm_desc')}
						onConfirm={() => onDelete(record.id)}
						okText={t('sys.menu.log.audit_log.yes')}
						cancelText={t('sys.menu.log.audit_log.no')}
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
		queryKey: ["audit", searchParams, pagination.current, pagination.pageSize],
		queryFn: () => logService.getLogAuditList({
			...searchParams,
			option: {
				offset: (pagination.current - 1) * pagination.pageSize,
				limit: pagination.pageSize,
			}
		}),
	});

	const list = Array.isArray(data?.data) ? data.data : [];
	const listPagination = data && typeof data === "object" ? (data as { pagination?: { total?: number } }).pagination : undefined;

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
		const { searchField = 'action', searchValue = '', ...rest } = values;
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
			await logService.deleteLogAudit(id);
			toast.success(t('sys.menu.log.audit_log.delete_success'));
			queryClient.invalidateQueries({ queryKey: ["audit"] });
		} catch (error) {
			toast.error(t('sys.menu.log.audit_log.delete_error'));
		}
	};

	const onView = (record: any) => {
		setAuditProps((prev) => ({
			...prev,
			show: true,
			title: t('sys.menu.log.audit_log.view_title'),
			formValue: record,
		}));
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch} initialValues={{ searchField: 'action' }}>
					<Row gutter={[16, 16]}>
						<Col span={24} lg={8}>
							<Form.Item
								label={t('sys.menu.log.audit_log.search_field')}
								name="searchField"
								className="!mb-0"
							>
								<Select
									onChange={() => {
										searchForm.setFieldValue('searchValue', '');
									}}
								>
									<Select.Option value="action">{t('sys.menu.log.audit_log.action')}</Select.Option>
									<Select.Option value="status">{t('sys.menu.log.audit_log.status')}</Select.Option>
									<Select.Option value="user_id">{t('sys.menu.log.audit_log.user_id')}</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={10}>
							<Form.Item
								noStyle
								shouldUpdate={(prev, curr) => prev?.searchField !== curr?.searchField || !prev?.searchField}
							>
								{({ getFieldValue }) => {
									const searchField = getFieldValue('searchField') || 'action';
									
									if (searchField === 'action') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Input placeholder={t('sys.menu.log.audit_log.action_placeholder')} />
											</Form.Item>
										);
									}
									
									if (searchField === 'status') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Select allowClear>
													<Select.Option value="success">
														<Tag color="success">{t('sys.menu.log.audit_log.status_success')}</Tag>
													</Select.Option>
													<Select.Option value="error">
														<Tag color="error">{t('sys.menu.log.audit_log.status_error')}</Tag>
													</Select.Option>
												</Select>
											</Form.Item>
										);
									}
									
									if (searchField === 'user_id') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Input type="number" placeholder={t('sys.menu.log.audit_log.user_id_placeholder')} />
											</Form.Item>
										);
									}
									
									return null;
								}}
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<div className="flex justify-end">
								<Button onClick={onSearchFormReset}>{t('sys.menu.log.audit_log.reset')}</Button>
								<Button type="primary" className="ml-4" htmlType="submit">
									{t('sys.menu.log.audit_log.search')}
								</Button>
							</div>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card title={t('sys.menu.audit_log')}>
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

			<AuditLog {...auditProps} />
		</Space>
	);
}

type AuditProps = {
	formValue: any;
	title: string;
	show: boolean;
	onOk: VoidFunction;
	onCancel: VoidFunction;
};

function AuditLog({
	title,
	show,
	formValue,
	onOk,
	onCancel,
}: AuditProps) {
	const [form] = Form.useForm();

	useEffect(() => {
		if (show) {
			form.resetFields();
			form.setFieldsValue(formValue);
		}
	}, [show, formValue, form]);

	return (
		<Modal 
			title={title} 
			open={show} 
			onOk={onOk} 
			onCancel={onCancel}
			width={800}
			destroyOnClose
		>
			<Form
				form={form}
				layout="vertical"
				initialValues={formValue}
				preserve={false}
			>
				<Form.Item label={t('sys.menu.log.audit_log.user_id')} name="user_id">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.action')} name="action">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.status')} name="status">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.ip_address')} name="ip_address">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.user_agent')} name="user_agent">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.request_data')} name="request_data">
					<Input.TextArea rows={4} disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.response_data')} name="response_data">
					<Input.TextArea rows={4} disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.response_time')} name="response_time">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.audit_log.error_message')} name="error_message">
					<Input.TextArea rows={2} disabled />
				</Form.Item>
			</Form>
		</Modal>
	);
}
