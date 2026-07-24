import { useQuery } from "@tanstack/react-query";
import {
	Button,
	Card,
	Col,
	Form,
	Input,
	Modal,
	Row,
	Select,
	Space,
	Tag,
	Table,
	Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";

import { IconButton, Iconify } from "@/components/icon";
import type { LogAlarm } from "@/types/entity";
import type { LogAlarmSearchParams } from "@/api/services/log";
import logService from "@/api/services/log";
import { t } from "@/locales/i18n";

export default function AlarmPage() {
	const [searchForm] = Form.useForm();
	// const queryClient = useQueryClient();
	const [pagination, setPagination] = useState({
		current: 1,
		pageSize: 10,
		total: 0,
	});
	const [searchParams, setSearchParams] = useState<LogAlarmSearchParams>(Object.assign({}));
	const [alarmProps, setAlarmProps] = useState<AlarmProps>({
		formValue: {
			id: 0,
			user_id: 0,
			company_id: null,
			type: 'system',
			title: '',
			content: '',
			priority: 'medium',
			is_read: false,
			read_at: null,
			action_url: null,
			action_text: null,
			metadata: null,
			is_email_sent: false,
			email_sent_at: null,
			is_push_sent: false,
			push_sent_at: null,
			expires_at: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		},
		title: "New",
		show: false,
		onOk: () => {
			setAlarmProps((prev) => ({ ...prev, show: false }));
		},
		onCancel: () => {
			setAlarmProps((prev) => ({ ...prev, show: false }));
		},
	});

	const columns: ColumnsType<LogAlarm> = [
		{ 
			title: t('sys.menu.log.alarm_log.title'), 
			dataIndex: "title", 
			width: 200,
			render: (title) => (
				<Tooltip title={title}>
					<span className="truncate block max-w-[200px]">{title}</span>
				</Tooltip>
			)
		},
		{
			title: t('sys.menu.log.alarm_log.type'),
			dataIndex: "type",
			width: 100,
			render: (type) => (
				<Tag color={
					type === 'system' ? 'blue' :
					type === 'payment' ? 'green' :
					type === 'security' ? 'red' :
					type === 'usage' ? 'purple' :
					type === 'maintenance' ? 'orange' :
					'default'
				}>
					{type === 'system' ? t('sys.menu.log.alarm_log.type_system') :
					 type === 'payment' ? t('sys.menu.log.alarm_log.type_payment') :
					 type === 'security' ? t('sys.menu.log.alarm_log.type_security') :
					 type === 'usage' ? t('sys.menu.log.alarm_log.type_usage') :
					 type === 'maintenance' ? t('sys.menu.log.alarm_log.type_maintenance') :
					 type === 'custom' ? t('sys.menu.log.alarm_log.type_custom') :
					 type.charAt(0).toUpperCase() + type.slice(1)}
				</Tag>
			),
		},
		{
			title: t('sys.menu.log.alarm_log.priority'),
			dataIndex: "priority",
			width: 100,
			render: (priority) => (
				<Tag color={
					priority === 'urgent' ? 'red' :
					priority === 'high' ? 'orange' :
					priority === 'medium' ? 'blue' :
					'default'
				}>
					{priority === 'low' ? t('sys.menu.log.alarm_log.priority_low') :
					 priority === 'medium' ? t('sys.menu.log.alarm_log.priority_medium') :
					 priority === 'high' ? t('sys.menu.log.alarm_log.priority_high') :
					 priority === 'urgent' ? t('sys.menu.log.alarm_log.priority_urgent') :
					 priority.charAt(0).toUpperCase() + priority.slice(1)}
				</Tag>
			),
		},
		{
			title: t('sys.menu.log.alarm_log.status'),
			dataIndex: "is_read",
			width: 100,
			render: (is_read) => (
				<Tag color={is_read ? "success" : "warning"}>
					{is_read ? t('sys.menu.log.alarm_log.read') : t('sys.menu.log.alarm_log.unread')}
				</Tag>
			),
		},
		{
			title: t('sys.menu.log.alarm_log.email'),
			dataIndex: "is_email_sent",
			width: 100,
			render: (is_email_sent) => (
				<Tag color={is_email_sent ? "success" : "default"}>
					{is_email_sent ? t('sys.menu.log.alarm_log.sent') : t('sys.menu.log.alarm_log.not_sent')}
				</Tag>
			),
		},
		{
			title: t('sys.menu.log.alarm_log.push'),
			dataIndex: "is_push_sent",
			width: 100,
			render: (is_push_sent) => (
				<Tag color={is_push_sent ? "success" : "default"}>
					{is_push_sent ? t('sys.menu.log.alarm_log.sent') : t('sys.menu.log.alarm_log.not_sent')}
				</Tag>
			),
		},
		{
			title: t('sys.menu.log.alarm_log.created_at'),
			dataIndex: "created_at",
			width: 150,
			render: (date) => new Date(date).toLocaleString(),
		},
		{
			title: t('sys.menu.log.alarm_log.action'),
			key: "operation",
			width: 120,
			render: (_, record) => (
				<Space>
					<IconButton onClick={() => onView(record)}>
						<Iconify icon="solar:eye-bold-duotone" size={18} />
					</IconButton>
				</Space>
			),
		},
	];

	const { data, isLoading } = useQuery({
		queryKey: ["alarm", searchParams, pagination.current, pagination.pageSize],
		queryFn: () => logService.getAlarmList({
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
		const { searchField = 'type', searchValue = '', ...rest } = values;
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

	const onView = (record: LogAlarm) => {
		setAlarmProps((prev) => ({
			...prev,
			show: true,
			title: t('sys.menu.log.alarm_log.view_title'),
			formValue: record,
		}));
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Form form={searchForm} onFinish={onSearch} initialValues={{ searchField: 'type' }}>
					<Row gutter={[16, 16]}>
						<Col span={24} lg={8}>
							<Form.Item
								label={t('sys.menu.log.alarm_log.search_field')}
								name="searchField"
								className="!mb-0"
							>
								<Select
									onChange={() => {
										searchForm.setFieldValue('searchValue', '');
									}}
								>
									<Select.Option value="type">{t('sys.menu.log.alarm_log.type')}</Select.Option>
									<Select.Option value="priority">{t('sys.menu.log.alarm_log.priority')}</Select.Option>
									<Select.Option value="is_read">{t('sys.menu.log.alarm_log.status')}</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col span={24} lg={10}>
							<Form.Item
								noStyle
								shouldUpdate={(prev, curr) => prev?.searchField !== curr?.searchField || !prev?.searchField}
							>
								{({ getFieldValue }) => {
									const searchField = getFieldValue('searchField') || 'type';
									
									if (searchField === 'type') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Select allowClear>
													<Select.Option value="system">{t('sys.menu.log.alarm_log.type_system')}</Select.Option>
													<Select.Option value="payment">{t('sys.menu.log.alarm_log.type_payment')}</Select.Option>
													<Select.Option value="security">{t('sys.menu.log.alarm_log.type_security')}</Select.Option>
													<Select.Option value="usage">{t('sys.menu.log.alarm_log.type_usage')}</Select.Option>
													<Select.Option value="maintenance">{t('sys.menu.log.alarm_log.type_maintenance')}</Select.Option>
													<Select.Option value="custom">{t('sys.menu.log.alarm_log.type_custom')}</Select.Option>
												</Select>
											</Form.Item>
										);
									}
									
									if (searchField === 'priority') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Select allowClear>
													<Select.Option value="low">{t('sys.menu.log.alarm_log.priority_low')}</Select.Option>
													<Select.Option value="medium">{t('sys.menu.log.alarm_log.priority_medium')}</Select.Option>
													<Select.Option value="high">{t('sys.menu.log.alarm_log.priority_high')}</Select.Option>
													<Select.Option value="urgent">{t('sys.menu.log.alarm_log.priority_urgent')}</Select.Option>
												</Select>
											</Form.Item>
										);
									}
									
									if (searchField === 'is_read') {
										return (
											<Form.Item
												name="searchValue"
												className="!mb-0"
											>
												<Select allowClear>
													<Select.Option value={true}>
														<Tag color="success">{t('sys.menu.log.alarm_log.read')}</Tag>
													</Select.Option>
													<Select.Option value={false}>
														<Tag color="warning">{t('sys.menu.log.alarm_log.unread')}</Tag>
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
								<Button onClick={onSearchFormReset}>{t('sys.menu.log.alarm_log.reset')}</Button>
								<Button type="primary" className="ml-4" htmlType="submit">
									{t('sys.menu.log.alarm_log.search')}
								</Button>
							</div>
						</Col>
					</Row>
				</Form>
			</Card>

			<Card
				title={t('sys.menu.alarm')}
			>
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

			<Alarm {...alarmProps} />
		</Space>
	);
}

type AlarmProps = {
	formValue: LogAlarm;
	title: string;
	show: boolean;
	onOk: VoidFunction;
	onCancel: VoidFunction;
};

function Alarm({
	title,
	show,
	formValue,
	onOk,
	onCancel,
}: AlarmProps) {
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
				<Row gutter={16}>
					<Col span={12}>
						<Form.Item
							label={t('sys.menu.log.alarm_log.type_label')}
							name="type"
						>
							<Input disabled />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={t('sys.menu.log.alarm_log.priority_label')}
							name="priority"
						>
							<Input disabled />
						</Form.Item>
					</Col>
				</Row>
				<Form.Item
					label={t('sys.menu.log.alarm_log.title_label')}
					name="title"
				>
					<Input disabled />
				</Form.Item>
				<Form.Item
					label={t('sys.menu.log.alarm_log.content_label')}
					name="content"
				>
					<Input.TextArea rows={4} disabled />
				</Form.Item>
				<Row gutter={16}>
					<Col span={12}>
						<Form.Item
							label={t('sys.menu.log.alarm_log.email_status')}
							name="is_email_sent"
						>
							<Input disabled />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={t('sys.menu.log.alarm_log.push_status')}
							name="is_push_sent"
						>
							<Input disabled />
						</Form.Item>
					</Col>
				</Row>
				<Row gutter={16}>
					<Col span={12}>
						<Form.Item
							label={t('sys.menu.log.alarm_log.created_at')}
							name="created_at"
						>
							<Input disabled />
						</Form.Item>
					</Col>
					<Col span={12}>
						<Form.Item
							label={t('sys.menu.log.alarm_log.updated_at')}
							name="updated_at"
						>
							<Input disabled />
						</Form.Item>
					</Col>
				</Row>
			</Form>
		</Modal>
	);
}
