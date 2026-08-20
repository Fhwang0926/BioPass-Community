// @ts-nocheck
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Col, Form, Input, Row, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import Card from "@/components/card";
import { Iconify } from "@/components/icon";
import companyService from "@/api/services/company";
import type { UpdateCompanyParams } from "@/api/services/company";
import { useUserInfo } from "@/store/userStore";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/locales/locale-meta";
const normalizeCompany = (company: any) => {
	if (!company) return null;

	return {
		...company,
		business_no: company.business_no ?? company.businessNo,
		is_active: company.is_active ?? company.isActive,
		created_at: company.created_at ?? company.createdAt,
		updated_at: company.updated_at ?? company.updatedAt,
	};
};

export default function TeamsTab() {
	const { t, i18n } = useTranslation();
	const [form] = Form.useForm();
	const queryClient = useQueryClient();
	const userInfo = useUserInfo();
	const companyId = userInfo.company_id;
	const [isEditing, setIsEditing] = useState(false);
	const perm = String(userInfo.permissions || "").toUpperCase();
	const isCompanyAdmin = perm === "ADMIN" || perm === "SUPER_ADMIN";

	const { data: companyData, isLoading } = useQuery({
		queryKey: ["company", companyId],
		queryFn: () => companyService.getCompany(companyId!),
		enabled: !!companyId,
	});
	const company = useMemo(() => normalizeCompany(companyData), [companyData]);

	const handleSubmit = async (values: UpdateCompanyParams) => {
		try {
			if (!company?.id) {
				toast.error(t("sys.menu.account.company.not_found"));
				return;
			}

			await companyService.updateCompany({
				id: company.id,
				name: values.name,
				code: values.code,
				business_no: values.business_no,
				email: values.email,
			});
			toast.success(t("sys.menu.account.company.update_success"));
			queryClient.invalidateQueries({ queryKey: ["company", company.id] });
			setIsEditing(false);
		} catch (error) {
			toast.error(t("sys.menu.account.company.update_error"));
		}
	};

	useEffect(() => {
		if (company) {
			form.setFieldsValue({
				name: company.name,
				code: company.code,
				business_no: company.business_no,
				email: company.email,
			});
		}
	}, [company, form]);

	const handleCancel = () => {
		if (company) {
			form.setFieldsValue({
				name: company.name,
				code: company.code,
				business_no: company.business_no,
				email: company.email,
			});
		}
		setIsEditing(false);
	};

	if (isLoading) {
		return <div>{t("sys.menu.account.company.loading")}</div>;
	}

	if (!companyId) {
		return <div>{t("sys.menu.account.company.not_found")}</div>;
	}

	return (
		<Row gutter={[16, 16]}>
			<Col span={24}>
				<Card className="flex-col">
					<div className="flex w-full flex-col">
						<div className="flex items-center justify-between mb-4">
							<Typography.Title level={5}>{t("sys.menu.account.company.title")}</Typography.Title>
							{isCompanyAdmin && (
								<Button 
									type={isEditing ? "default" : "primary"}
									onClick={() => (isEditing ? handleCancel() : setIsEditing(true))}
								>
									{isEditing ? t("sys.menu.account.company.cancel") : t("sys.menu.account.company.edit_company")}
								</Button>
							)}
						</div>

						<Form
							form={form}
							layout="vertical"
							onFinish={handleSubmit}
							disabled={!isEditing}
						>
							<Row gutter={16}>
								<Col span={12}>
									<Form.Item
										label={t("sys.menu.account.company.company_name")}
										name="name"
										rules={[{ required: true, message: t("sys.menu.account.company.company_name_required") }]}
									>
										<Input prefix={<Iconify icon="mdi:office-building" />} />
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item
										label={t("sys.menu.account.company.company_code")}
										name="code"
									>
										<Input prefix={<Iconify icon="mdi:identifier" />} />
									</Form.Item>
								</Col>
							</Row>

							<Row gutter={16}>
								<Col span={12}>
									<Form.Item
										label={t("sys.menu.account.company.business_number")}
										name="business_no"
										rules={[
											{
												max: 30,
												message: t("sys.menu.account.company.business_number_max")
											}
										]}
									>
										<Input prefix={<Iconify icon="mdi:card-account-details" />} maxLength={30} />
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item
										label={t("sys.menu.account.company.email")}
										name="email"
									>
										<Input prefix={<Iconify icon="mdi:email" />} />
									</Form.Item>
								</Col>
							</Row>

							{isEditing && (
								<Form.Item>
									<Space>
										<Button type="primary" htmlType="submit">
											{t("sys.menu.account.company.save_changes")}
										</Button>
										<Button onClick={handleCancel}>
											{t("sys.menu.account.company.cancel")}
										</Button>
									</Space>
								</Form.Item>
							)}
						</Form>
					</div>
				</Card>
			{/* </Col>

			<Col span={24}> */}
				<Card className="flex-col !items-start mt-2">
					<Typography.Title level={5}>{t("sys.menu.account.company.company_status")}</Typography.Title>
					<div className="mt-4 w-full">
						<Space direction="vertical" size="large" className="w-full">
							<div className="flex items-center justify-between">
								<div>
									<Typography.Text strong>{t("sys.menu.account.company.company_status")}</Typography.Text>
									<div className="text-gray-500">
										{company?.is_active ? t("common.active") : t("common.inactive")}
									</div>
								</div>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<Typography.Text strong>{t("sys.menu.account.company.created_at")}</Typography.Text>
									<div className="text-gray-500">
										{company?.created_at ? formatDateTime(company.created_at, i18n.resolvedLanguage) : t("common.na")}
									</div>
								</div>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<Typography.Text strong>{t("sys.menu.account.company.last_updated")}</Typography.Text>
									<div className="text-gray-500">
										{company?.updated_at ? formatDateTime(company.updated_at, i18n.resolvedLanguage) : t("common.na")}
									</div>
								</div>
							</div>
						</Space>
					</div>
				</Card>
			</Col>
		</Row>
	);
}
