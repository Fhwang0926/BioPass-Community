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

import type { LogMailSearchParams } from "@/api/services/log";
import logService from "@/api/services/log";
import { t } from "@/locales/i18n";

export default function MailLogPage() {
	const [searchForm] = Form.useForm();
	const queryClient = useQueryClient();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 10,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<LogMailSearchParams>(Object.assign({}));
	const [mailProps, setMailProps] = useState<MailProps>({
		formValue: {
			id: 0,
			user_id: 0,
			email: "",
			subject: "",
			content: "",
			status: "pending",
			sent_at: "",
			error_message: "",
		},
		title: "New",
		show: false,
		onOk: () => {
			setMailProps((prev) => ({ ...prev, show: false }));
		},
		onCancel: () => {
			setMailProps((prev) => ({ ...prev, show: false }));
		},
	});

	const columns: ColumnsType<any> = [
		// { title: t('sys.menu.log.mail_log.user_id'), dataIndex: "user_id", width: 100 },
		{ title: t('sys.menu.log.mail_log.email'), dataIndex: "to", width: 200 },
		{ title: t('sys.menu.log.mail_log.subject'), dataIndex: "title", width: 200 },
		{ 
			title: t('sys.menu.log.mail_log.status'), 
			dataIndex: "is_clear", 
			width: 100,
			render: (is_clear: boolean, record: { is_done: boolean }) => {
				if (!record.is_done) {
					return <Tag color="warning">{t('sys.menu.log.mail_log.status_pending')}</Tag>;
				}
				
				return (
					<Tag color={is_clear ? "success" : "error"}>
						{is_clear ? t('sys.menu.log.mail_log.status_success') : t('sys.menu.log.mail_log.status_error')}
					</Tag>
				);
			},
		},
		{ title: t('sys.menu.log.mail_log.sent_at'), dataIndex: "sent_at", width: 180 },
		{ title: t('sys.menu.log.mail_log.created_at'), dataIndex: "created_at", width: 180 },
		{
			title: t('sys.menu.log.mail_log.action'),
			key: "operation",
			width: 120,
			render: (_, record) => (
				<Space>
					<IconButton onClick={() => onView(record)}>
						<Iconify icon="solar:eye-bold-duotone" size={18} />
					</IconButton>
					<Popconfirm
						title={t('sys.menu.log.mail_log.delete_confirm_title')}
						description={t('sys.menu.log.mail_log.delete_confirm_desc')}
						onConfirm={() => onDelete(record.id)}
						okText={t('sys.menu.log.mail_log.yes')}
						cancelText={t('sys.menu.log.mail_log.no')}
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
		queryKey: ["mail", searchParams, pagination.current, pagination.pageSize],
		queryFn: () => logService.getLogMailList({
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
		const { searchField = 'to', searchValue = '', ...rest } = values;
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
			await logService.deleteLogMail(id);
			toast.success(t('sys.menu.log.mail_log.delete_success'));
			queryClient.invalidateQueries({ queryKey: ["mail"] });
		} catch (error) {
			toast.error(t('sys.menu.log.mail_log.delete_error'));
		}
	};

	const onView = (record: any) => {
		setMailProps((prev) => ({
			...prev,
			show: true,
			title: t('sys.menu.log.mail_log.view_title'),
			formValue: record,
		}));
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch} initialValues={{ searchField: 'to' }}>
					<Row gutter={[16, 16]}>
						<Col span={24} lg={8}>
							<Form.Item
								label={t('sys.menu.log.mail_log.search_field')}
								name="searchField"
								className="!mb-0"
							>
								<Select
									onChange={() => {
										searchForm.setFieldValue('searchValue', '');
									}}
								>
									<Select.Option value="to">{t('sys.menu.log.mail_log.to')}</Select.Option>
									<Select.Option value="from">{t('sys.menu.log.mail_log.from')}</Select.Option>
									<Select.Option value="status">{t('sys.menu.log.mail_log.status')}</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={10}>
							<Form.Item
								noStyle
								shouldUpdate={(prev, curr) => prev?.searchField !== curr?.searchField || !prev?.searchField}
							>
								{({ getFieldValue }) => {
									const searchField = getFieldValue('searchField') || 'to';
									
									if (searchField === 'to') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Input placeholder={t('sys.menu.log.mail_log.to_placeholder')} />
											</Form.Item>
										);
									}
									
									if (searchField === 'from') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Input placeholder={t('sys.menu.log.mail_log.from_placeholder')} />
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
														<Tag color="success">{t('sys.menu.log.mail_log.status_success')}</Tag>
													</Select.Option>
													<Select.Option value="error">
														<Tag color="error">{t('sys.menu.log.mail_log.status_error')}</Tag>
													</Select.Option>
												</Select>
											</Form.Item>
										);
									}
									
									return null;
								}}
							</Form.Item>
						</Col>
						<Col span={24} lg={6}>
							<div className="flex justify-end">
								<Button onClick={onSearchFormReset}>{t('sys.menu.log.mail_log.reset')}</Button>
								<Button type="primary" className="ml-4" htmlType="submit">
									{t('sys.menu.log.mail_log.search')}
								</Button>
							</div>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card title={t('sys.menu.mail_log')}>
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

			<MailLog {...mailProps} />
		</Space>
	);
}

type MailProps = {
	formValue: any;
	title: string;
	show: boolean;
	onOk: VoidFunction;
	onCancel: VoidFunction;
};

function MailLog({
	title,
	show,
	formValue,
	onOk,
	onCancel,
}: MailProps) {
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
				<Form.Item label={t('sys.menu.log.mail_log.title_label')} name="title">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.content_label')} name="content">
					<Input.TextArea rows={4} disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.to_label')} name="to">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.cc_label')} name="cc">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.bcc_label')} name="bcc">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.from_label')} name="from">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.from_name_label')} name="from_name">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.status_label')}>
					<Input.Group compact>
						<Form.Item name="is_done" noStyle>
							<Input 
								style={{width: '50%'}}
								disabled
								addonBefore={t('sys.menu.log.mail_log.sent_label')}
							/>
						</Form.Item>
						<Form.Item name="is_clear" noStyle>
							<Input
								style={{width: '50%'}}
								disabled
								addonBefore={t('sys.menu.log.mail_log.success_label')}
							/>
						</Form.Item>
					</Input.Group>
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.html_email')} name="is_html">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.uuid')} name="uuid">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.error_message')} name="error_msg">
					<Input.TextArea rows={2} disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.sent_at')} name="sent_at">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.created_at')} name="created_at">
					<Input disabled />
				</Form.Item>
				<Form.Item label={t('sys.menu.log.mail_log.updated_at')} name="updated_at">
					<Input disabled />
				</Form.Item>
			</Form>
		</Modal>
	);
}
