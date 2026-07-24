import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { Alert, Button, Card, Form, message, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import applicationService, { type Application } from "@/api/services/application";
import { DetailHeader } from "./DetailHeader";
import { BasicInfoCard } from "./BasicInfoCard";
import { AuthSettingsCard } from "./AuthSettingsCard";
import { DetailActions } from "./DetailActions";

function normalizeDomain(domain: string): string {
	if (!domain) return domain;
	return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export default function ApplicationDetailPage() {
	const { t } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [form] = Form.useForm();
	const [showSecret, setShowSecret] = useState(false);
	const [newSecret, setNewSecret] = useState<string | null>(null);
	const [regenerating, setRegenerating] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["application", id],
		queryFn: () => applicationService.getApplication(Number(id)),
		enabled: !!id,
	});

	const application: Application | undefined =
		data && typeof data === "object" && "id" in data
			? (data as Application)
			: (data as unknown as { data?: Application })?.data;

	useEffect(() => {
		if (application) {
			form.setFieldsValue({
				name: application.name,
				callback_url: application.callbackUrl,
				login_identifier: application.loginIdentifier,
				auth_request_expiry: application.authRequestExpiry,
				duplicate_request_limit: application.duplicateRequestLimit,
				is_active: application.isActive,
			});
		}
	}, [application, form]);

	const handleSubmit = async (values: Record<string, unknown>) => {
		if (!id) return;
		try {
			const normalizedValues = {
				...values,
				name: normalizeDomain(values.name as string),
			};
			await applicationService.updateApplication({
				id: Number(id),
				...normalizedValues,
			} as Parameters<typeof applicationService.updateApplication>[0]);
			toast.success(t("sys.menu.application.detailPage.update_success"));
			queryClient.invalidateQueries({ queryKey: ["application"] });
		} catch {
			toast.error(t("sys.menu.application.detailPage.update_error"));
		}
	};

	const handleRegenerateSecret = async () => {
		if (!id) return;
		setRegenerating(true);
		try {
			const response = await applicationService.regenerateSecret(Number(id));
			if (response?.clientSecret) {
				setNewSecret(response.clientSecret);
				setShowSecret(true);
				toast.success(t("sys.menu.application.detailPage.regenerate_success"));
				queryClient.invalidateQueries({ queryKey: ["application", id] });
			} else {
				toast.error(t("sys.menu.application.detailPage.regenerate_error"));
			}
		} catch (error: unknown) {
			const err = error as { response?: { data?: { message?: string } }; message?: string };
			const errorMessage = err?.response?.data?.message || err?.message || "";
			toast.error(t("sys.menu.application.detailPage.regenerate_failed", { message: errorMessage }));
		} finally {
			setRegenerating(false);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		message.success(t("sys.menu.application.detailPage.copy_success"));
	};

	const ns = "sys.menu.application.detailPage";

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Spin size="large" tip={t(`${ns}.loading`)} />
			</div>
		);
	}

	if (!application) {
		return (
			<Card>
				<Alert
					message={t(`${ns}.not_found`)}
					description={t(`${ns}.not_found_desc`)}
					type="error"
					showIcon
					action={
						<Button onClick={() => navigate("/service/application")}>{t(`${ns}.back_to_list`)}</Button>
					}
				/>
			</Card>
		);
	}

	return (
		<Space direction="vertical" size="large" className="w-full" style={{ padding: "0" }}>
			<DetailHeader application={application} onBack={() => navigate("/service/application")} />

			<Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={application}>
				<BasicInfoCard
					form={form}
					application={application}
					showSecret={showSecret}
					newSecret={newSecret}
					regenerating={regenerating}
					onCopy={copyToClipboard}
					onRegenerateSecret={handleRegenerateSecret}
				/>
				<AuthSettingsCard />
				<DetailActions onCancel={() => navigate("/service/application")} />
			</Form>
		</Space>
	);
}
