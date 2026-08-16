import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button, Card, Col, Form, InputNumber, Row, Select, Switch } from "antd";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Iconify } from "@/components/icon";
import policySecurityService from "@/api/services/policy-security";
import type {
	PolicyType,
	SavePolicyParams,
	SecurityPolicy,
} from "@/api/services/policy-security";

// 기본값 정의
const DEFAULT_VALUES: Partial<
	Record<
		PolicyType,
		{ threshold?: number | null; windowSeconds?: number | null }
	>
> = {
	IP_MULTIPLE: { threshold: 5, windowSeconds: 60 },
	FAIL_LIMIT: { threshold: 3, windowSeconds: 300 },
	PUSH_BOMB: { threshold: 10, windowSeconds: 60 },
	MULTIPLE_REQUESTS: { threshold: 5, windowSeconds: 10 },
};

function parseCountries(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean);
	}
	if (typeof value !== "string" || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) return parseCountries(parsed);
	} catch {
		// Accept comma-separated legacy/manual values as a fallback.
	}
	return value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
}

type PolicyNumericField = "threshold" | "windowSeconds";
type PolicyFormValues = Partial<Record<PolicyNumericField, number | null>>;

interface PolicyDefinition {
	key: PolicyType;
	title: string;
	description: string;
	fields?: Array<{
		name: PolicyNumericField;
		label: string;
		placeholder: string;
	}>;
}

// 정책 항목 컴포넌트
interface PolicyItemProps {
	policy: PolicyDefinition;
	savedPolicy?: SecurityPolicy;
	onChange: (
		policyKey: PolicyType,
		enabled: boolean,
		values?: PolicyFormValues,
	) => void;
	isSaving: boolean;
}

function PolicyItem({
	policy,
	savedPolicy,
	onChange,
	isSaving,
}: PolicyItemProps) {
	const { t } = useTranslation();
	const [form] = Form.useForm<PolicyFormValues>();
	// enabled 필드가 boolean이 아닌 경우를 대비해 명시적으로 변환
	// Postgres may still serialize booleans as 0/1 depending on driver/path
	const rawEnabled = (savedPolicy as any)?.enabled;
	const enabled = savedPolicy
		? rawEnabled === true || rawEnabled === 1 || rawEnabled === "1"
		: true;
	const defaultValues = DEFAULT_VALUES[policy.key] || {};
	const formValues =
		savedPolicy && policy.fields
			? {
					threshold: savedPolicy.threshold ?? defaultValues.threshold,
					windowSeconds:
						savedPolicy.windowSeconds ?? defaultValues.windowSeconds,
				}
			: defaultValues;

	// 폼 초기값 설정 - savedPolicy가 변경될 때마다 업데이트
	useEffect(() => {
		if (policy.fields) {
			const newFormValues = {
				threshold: savedPolicy?.threshold ?? defaultValues.threshold,
				windowSeconds:
					savedPolicy?.windowSeconds ?? defaultValues.windowSeconds,
			};
			form.setFieldsValue(newFormValues);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [policy.key, savedPolicy]);

	const saveWithValidation = async () => {
		try {
			const values = policy.fields ? await form.validateFields() : undefined;
			onChange(policy.key, enabled, values);
		} catch {
			return;
		}
	};

	return (
		<Card
			size="small"
			className="policy-item-card"
			style={{
				border: `1px solid ${enabled ? "#d9d9d9" : "#f0f0f0"}`,
				borderRadius: "8px",
				transition: "all 0.3s ease",
				backgroundColor: enabled ? "#fff" : "#fafafa",
			}}
			styles={{ body: { padding: "20px" } }}
		>
			<Row gutter={[24, 16]} align="middle">
				<Col span={24} lg={policy.fields ? 7 : 24}>
					<div className="flex items-start gap-3">
						<div className="flex-shrink-0 mt-1">
							<Switch
								checked={enabled}
								disabled={isSaving}
								loading={isSaving}
								onChange={(checked) => {
									if (policy.fields) {
										onChange(policy.key, checked, form.getFieldsValue());
									} else {
										onChange(policy.key, checked);
									}
								}}
							/>
						</div>
						<div className="flex-1" style={{ minWidth: 0 }}>
							<div
								className="font-semibold text-base mb-1"
								style={{
									color: enabled ? "#262626" : "#8c8c8c",
									transition: "color 0.3s ease",
									wordBreak: "keep-all",
									overflowWrap: "break-word",
								}}
							>
								{policy.title}
							</div>
							<div
								className="text-sm"
								style={{
									color: enabled ? "#595959" : "#bfbfbf",
									lineHeight: "1.5",
									transition: "color 0.3s ease",
									wordBreak: "keep-all",
									overflowWrap: "break-word",
									whiteSpace: "normal",
								}}
							>
								{policy.description}
							</div>
						</div>
					</div>
				</Col>
				{policy.fields && (
					<Col span={24} lg={17}>
						<div
							style={{
								opacity: enabled ? 1 : 0.6,
								transition: "opacity 0.3s ease",
							}}
						>
							<Form
								form={form}
								layout="vertical"
								initialValues={formValues}
								className="policy-form"
							>
								<Row gutter={[16, 0]} align="bottom">
									{policy.fields.map((field) => (
										<Col key={field.name} xs={24} sm={12} lg={8}>
											<Form.Item
												name={field.name}
												label={
													<span
														style={{
															fontSize: "13px",
															color: enabled ? "#595959" : "#bfbfbf",
														}}
													>
														{field.label}
													</span>
												}
												rules={[
													{
														required: true,
														message: t("sys.page.policySecurity.fieldRequired", { field: field.label }),
													},
													{
														type: "number",
														min: 1,
														message: t("sys.page.policySecurity.minOne"),
													},
												]}
												style={{ marginBottom: 0 }}
											>
												<InputNumber
													placeholder={field.placeholder}
													style={{ width: "100%" }}
													disabled={!enabled}
													size="large"
													min={1}
													precision={0}
												/>
											</Form.Item>
										</Col>
									))}
									<Col xs={24} sm={12} lg={8}>
										<Form.Item style={{ marginBottom: 0 }}>
											<Button
												type="primary"
												onClick={saveWithValidation}
												disabled={!enabled}
												loading={isSaving}
												size="large"
												block
												style={{
													height: "40px",
													fontWeight: 500,
												}}
											>
												{t("common.saveText")}
											</Button>
										</Form.Item>
									</Col>
								</Row>
							</Form>
						</div>
					</Col>
				)}
			</Row>
		</Card>
	);
}

function CountryAllowlistItem({
	savedPolicy,
	onChange,
	isSaving,
}: {
	savedPolicy?: SecurityPolicy | any;
	onChange: (enabled: boolean, countries: string[]) => void;
	isSaving: boolean;
}) {
	const { t } = useTranslation();
	const [form] = Form.useForm<{ allowedCountries: string[] }>();
	const rawEnabled = savedPolicy?.enabled;
	const enabled = savedPolicy
		? rawEnabled === true || rawEnabled === 1 || rawEnabled === "1"
		: false;
	const countries = parseCountries(savedPolicy?.allowedCountries ?? savedPolicy?.allowed_countries);

	useEffect(() => {
		form.setFieldsValue({ allowedCountries: countries });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [savedPolicy?.id, savedPolicy?.allowedCountries, savedPolicy?.allowed_countries]);

	const save = async () => {
		const values = await form.validateFields();
		onChange(enabled, values.allowedCountries || []);
	};

	return (
		<Card
			size="small"
			style={{
				border: `1px solid ${enabled ? "#d9d9d9" : "#f0f0f0"}`,
				borderRadius: "8px",
				backgroundColor: enabled ? "#fff" : "#fafafa",
			}}
			styles={{ body: { padding: "20px" } }}
		>
			<Row gutter={[24, 16]} align="middle">
				<Col span={24} lg={7}>
					<div className="flex items-start gap-3">
						<div className="flex-shrink-0 mt-1">
							<Switch
								checked={enabled}
								disabled={isSaving}
								loading={isSaving}
								onChange={(checked) => onChange(checked, form.getFieldValue("allowedCountries") || [])}
							/>
						</div>
						<div className="flex-1" style={{ minWidth: 0 }}>
							<div className="font-semibold text-base mb-1" style={{ color: enabled ? "#262626" : "#8c8c8c" }}>
								{t("sys.page.policySecurity.countryAllowlist")}
							</div>
							<div className="text-sm" style={{ color: enabled ? "#595959" : "#bfbfbf", lineHeight: "1.5" }}>
								{t("sys.page.policySecurity.countryAllowlistDesc")}
							</div>
						</div>
					</div>
				</Col>
				<Col span={24} lg={17}>
					<Form form={form} layout="vertical" initialValues={{ allowedCountries: countries }}>
						<Row gutter={[16, 0]} align="bottom">
							<Col xs={24} lg={16}>
								<Form.Item
									name="allowedCountries"
									label={<span style={{ fontSize: "13px", color: enabled ? "#595959" : "#bfbfbf" }}>{t("sys.page.policySecurity.allowedCountries")}</span>}
									style={{ marginBottom: 0 }}
								>
									<Select
										mode="multiple"
										allowClear
										disabled={!enabled}
										size="large"
										placeholder={t("sys.page.policySecurity.selectCountries")}
										options={["KR", "US", "JP", "CN", "GB", "DE", "FR", "CA"].map((code) => ({ label: t(`sys.page.policySecurity.countries.${code}`), value: code }))}
									/>
								</Form.Item>
							</Col>
							<Col xs={24} lg={8}>
								<Form.Item style={{ marginBottom: 0 }}>
									<Button
										type="primary"
										onClick={save}
										disabled={!enabled}
										loading={isSaving}
										size="large"
										block
										style={{ height: "40px", fontWeight: 500 }}
									>
										{t("common.saveText")}
									</Button>
								</Form.Item>
							</Col>
						</Row>
					</Form>
				</Col>
			</Row>
		</Card>
	);
}

export default function PolicySecurityPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [savingPolicyKey, setSavingPolicyKey] = useState<PolicyType | null>(
		null,
	);

	// 정책 목록 조회 (getPolicyList가 항상 배열 반환)
	const { data: policiesArray = [] } = useQuery({
		queryKey: ["policy-security"],
		queryFn: () => policySecurityService.getPolicyList(),
	});

	const policies: PolicyDefinition[] = [
		{
			key: "IP_MULTIPLE",
			title: t("sys.page.policySecurity.ipMultiple"),
			description: t("sys.page.policySecurity.ipMultipleDesc"),
			fields: [
				{ name: "threshold", label: t("sys.page.policySecurity.maxRequests"), placeholder: t("sys.page.policySecurity.example5") },
				{ name: "windowSeconds", label: t("sys.page.policySecurity.timeWindow"), placeholder: t("sys.page.policySecurity.example60") },
			],
		},
		{
			key: "FAIL_LIMIT",
			title: t("sys.page.policySecurity.failLimit"),
			description: t("sys.page.policySecurity.failLimitDesc"),
			fields: [
				{ name: "threshold", label: t("sys.page.policySecurity.maxFailures"), placeholder: t("sys.page.policySecurity.example3") },
				{
					name: "windowSeconds",
					label: t("sys.page.policySecurity.timeWindow"),
					placeholder: t("sys.page.policySecurity.example300"),
				},
			],
		},
		{
			key: "PUSH_BOMB",
			title: t("sys.page.policySecurity.pushBomb"),
			description: t("sys.page.policySecurity.pushBombDesc"),
			fields: [
				{ name: "threshold", label: t("sys.page.policySecurity.maxPushes"), placeholder: t("sys.page.policySecurity.example10") },
				{ name: "windowSeconds", label: t("sys.page.policySecurity.timeWindow"), placeholder: t("sys.page.policySecurity.example60") },
			],
		},
	];

	const riskDetections: PolicyDefinition[] = [
		{
			key: "COUNTRY_CHANGE",
			title: t("sys.page.policySecurity.countryChange"),
			description: t("sys.page.policySecurity.countryChangeDesc"),
		},
		{
			key: "NEW_DEVICE",
			title: t("sys.page.policySecurity.newDevice"),
			description: t("sys.page.policySecurity.newDeviceDesc"),
		},
		{
			key: "MULTIPLE_REQUESTS",
			title: t("sys.page.policySecurity.multipleRequests"),
			description: t("sys.page.policySecurity.multipleRequestsDesc"),
			fields: [
				{ name: "threshold", label: t("sys.page.policySecurity.maxRequests"), placeholder: t("sys.page.policySecurity.example5") },
				{ name: "windowSeconds", label: t("sys.page.policySecurity.timeWindow"), placeholder: t("sys.page.policySecurity.example10") },
			],
		},
	];

	// 정책 저장 mutation
	const savePolicyMutation = useMutation({
		mutationFn: (params: SavePolicyParams) =>
			policySecurityService.savePolicy(params),
		onSuccess: (savedPolicy: any) => {
			toast.success(t("sys.page.policySecurity.updateSuccess"));
			if (!savedPolicy || typeof savedPolicy !== "object") return;
			// 저장된 정책을 캐시에 반영해 화면이 즉시 갱신 (refetch로 덮어쓰지 않음)
			const keyOf = (p: any) =>
				`${p?.policyType ?? p?.policy_type ?? ""}_${p?.appId ?? p?.app_id ?? "null"}`;
			const normalized = {
				...savedPolicy,
				policyType: savedPolicy.policyType ?? savedPolicy.policy_type,
				appId: savedPolicy.appId ?? savedPolicy.app_id ?? null,
				windowSeconds: savedPolicy.windowSeconds ?? savedPolicy.window_seconds,
				enabled:
					savedPolicy.enabled === true ||
					savedPolicy.enabled === 1 ||
					savedPolicy.enabled === "1",
				allowedCountries: savedPolicy.allowedCountries ?? savedPolicy.allowed_countries ?? null,
			};
			queryClient.setQueryData(
				["policy-security"],
				(old: any[] | undefined) => {
					const list = Array.isArray(old) ? old : [];
					const savedKey = keyOf(normalized);
					const filtered = list.filter((p) => keyOf(p) !== savedKey);
					filtered.push(normalized);
					return filtered;
				},
			);
			queryClient.invalidateQueries({ queryKey: ["policy-security"] });
		},
		onError: () => {
			toast.error(t("sys.page.policySecurity.updateError"));
		},
		onSettled: () => {
			setSavingPolicyKey(null);
		},
	});

	const handlePolicyChange = async (
		policyKey: PolicyType,
		enabled: boolean,
		values?: PolicyFormValues,
	) => {
		const defaultValues = DEFAULT_VALUES[policyKey] || {};
		const policyData: SavePolicyParams = {
			policy_type: policyKey,
			enabled: enabled,
			threshold: values?.threshold ?? defaultValues.threshold ?? null,
			window_seconds:
				values?.windowSeconds ?? defaultValues.windowSeconds ?? null,
		};

		setSavingPolicyKey(policyKey);
		savePolicyMutation.mutate(policyData);
	};

	const handleCountryAllowlistChange = (enabled: boolean, countries: string[]) => {
		setSavingPolicyKey("COUNTRY_ALLOWLIST");
		savePolicyMutation.mutate({
			policy_type: "COUNTRY_ALLOWLIST",
			enabled,
			allowed_countries: countries,
		});
	};

	// 정책 데이터를 policyType 기준 맵으로 변환 (백엔드가 policyType 필드 반환)
	const policiesMap = new Map(
		(Array.isArray(policiesArray) ? policiesArray : []).map(
			(policy: SecurityPolicy | any) => [
				policy.policyType ?? policy.policy_type,
				policy,
			],
		),
	);

	return (
		<div className="w-full" style={{ padding: "0" }}>
			{/* 기본 정책 */}
			<Card
				title={
					<div className="flex items-center gap-2">
						<Iconify
							icon="solar:shield-check-bold-duotone"
							size={24}
							style={{ color: "#1890ff" }}
						/>
						<span style={{ fontSize: "18px", fontWeight: 600 }}>{t("sys.page.policySecurity.basePolicies")}</span>
					</div>
				}
				style={{
					marginBottom: "24px",
					borderRadius: "12px",
					boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
				}}
				styles={{ body: { padding: "24px" } }}
			>
				<div className="flex flex-col gap-4">
					<CountryAllowlistItem
						savedPolicy={policiesMap.get("COUNTRY_ALLOWLIST")}
						onChange={handleCountryAllowlistChange}
						isSaving={
							savePolicyMutation.isPending && savingPolicyKey === "COUNTRY_ALLOWLIST"
						}
					/>
					{policies.map((policy) => {
						const savedPolicy = policiesMap.get(policy.key);
						return (
							<PolicyItem
								key={policy.key}
								policy={policy}
								savedPolicy={savedPolicy}
								onChange={handlePolicyChange}
								isSaving={
									savePolicyMutation.isPending && savingPolicyKey === policy.key
								}
							/>
						);
					})}
				</div>
			</Card>

			{/* 위험 감지 */}
			<Card
				title={
					<div className="flex items-center gap-2">
						<Iconify
							icon="solar:danger-triangle-bold-duotone"
							size={24}
							style={{ color: "#ff4d4f" }}
						/>
						<span style={{ fontSize: "18px", fontWeight: 600 }}>{t("sys.page.policySecurity.riskDetection")}</span>
					</div>
				}
				style={{
					borderRadius: "12px",
					boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
				}}
				styles={{ body: { padding: "24px" } }}
			>
				<div className="flex flex-col gap-4">
					{riskDetections.map((detection) => {
						const savedPolicy = policiesMap.get(detection.key);
						return (
							<PolicyItem
								key={detection.key}
								policy={detection}
								savedPolicy={savedPolicy}
								onChange={handlePolicyChange}
								isSaving={
									savePolicyMutation.isPending &&
									savingPolicyKey === detection.key
								}
							/>
						);
					})}
				</div>
			</Card>
		</div>
	);
}
