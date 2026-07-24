import apiClient from "../apiClient";

export enum PolicySecurityApi {
	Policies = "sys_policy_security/policies",
}

export type PolicyType =
	| "IP_MULTIPLE"
	| "FAIL_LIMIT"
	| "PUSH_BOMB"
	| "COUNTRY_ALLOWLIST"
	| "COUNTRY_CHANGE"
	| "NEW_DEVICE"
	| "MULTIPLE_REQUESTS";

export interface SecurityPolicy {
	id: string;
	appId: number | null; // null이면 전역 정책
	policyType: PolicyType;
	threshold?: number | null;
	windowSeconds?: number | null;
	allowedCountries?: string[] | string | null;
	enabled: boolean;
	createdAt: number;
}

export interface SearchPoliciesParams {
	app_id?: string;
}

export interface SavePolicyParams {
	policy_type: PolicyType;
	app_id?: string | number | null;
	threshold?: number | null;
	window_seconds?: number | null;
	allowed_countries?: string[];
	enabled?: boolean;
}

// 보안 정책 목록 조회 - 백엔드가 배열을 payload로 반환 (인터셉터가 그대로 반환)
const getPolicyList = (params?: SearchPoliciesParams) =>
	apiClient.post<SecurityPolicy[]>({
		url: `${PolicySecurityApi.Policies}/search`,
		data: params || {},
	});

// 보안 정책 생성/수정 (인터셉터가 payload만 반환)
const savePolicy = (params: SavePolicyParams) =>
	apiClient.post<SecurityPolicy>({
		url: PolicySecurityApi.Policies,
		data: params,
	});

const policySecurityService = {
	getPolicyList,
	savePolicy,
};

export default policySecurityService;
