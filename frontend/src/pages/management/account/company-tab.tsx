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
				toast.error("Company information was not found");
				return;
			}

			await companyService.updateCompany({
				id: company.id,
				name: values.name,
				code: values.code,
				business_no: values.business_no,
				email: values.email,
			});
			toast.success("Company information updated successfully");
			queryClient.invalidateQueries({ queryKey: ["company", company.id] });
			setIsEditing(false);
		} catch (error) {
			toast.error("Failed to update company information");
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
		return <div>Loading...</div>;
	}

	if (!companyId) {
		return <div>Company information was not found.</div>;
	}

	return (
		<Row gutter={[16, 16]}>
			<Col span={24}>
				<Card className="flex-col">
					<div className="flex w-full flex-col">
						<div className="flex items-center justify-between mb-4">
							<Typography.Title level={5}>Company Information</Typography.Title>
							{isCompanyAdmin && (
								<Button 
									type={isEditing ? "default" : "primary"}
									onClick={() => (isEditing ? handleCancel() : setIsEditing(true))}
								>
									{isEditing ? "Cancel" : "Edit Company"}
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
										label="Company Name"
										name="name"
										rules={[{ required: true, message: "Please input company name!" }]}
									>
										<Input prefix={<Iconify icon="mdi:office-building" />} />
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item
										label="Company Code"
										name="code"
									>
										<Input prefix={<Iconify icon="mdi:identifier" />} />
									</Form.Item>
								</Col>
							</Row>

							<Row gutter={16}>
								<Col span={12}>
									<Form.Item
										label="Business Number"
										name="business_no"
										rules={[
											{
												max: 30,
												message: 'Business registration number cannot exceed 30 characters'
											}
										]}
									>
										<Input prefix={<Iconify icon="mdi:card-account-details" />} maxLength={30} />
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item
										label="Email"
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
											Save Changes
										</Button>
										<Button onClick={handleCancel}>
											Cancel
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
					<Typography.Title level={5}>Company Status</Typography.Title>
					<div className="mt-4 w-full">
						<Space direction="vertical" size="large" className="w-full">
							<div className="flex items-center justify-between">
								<div>
									<Typography.Text strong>Company Status</Typography.Text>
									<div className="text-gray-500">
										{company?.is_active ? "Active" : "Inactive"}
									</div>
								</div>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<Typography.Text strong>Created At</Typography.Text>
									<div className="text-gray-500">
										{company?.created_at ? new Date(company.created_at).toLocaleString() : "N/A"}
									</div>
								</div>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<Typography.Text strong>Last Updated</Typography.Text>
									<div className="text-gray-500">
										{company?.updated_at ? new Date(company.updated_at).toLocaleString() : "N/A"}
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
