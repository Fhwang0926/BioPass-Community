import apiClient from "../apiClient";

import type { UserInfo, UserToken } from "#/entity";

export interface SignInReq {
	email: string;
	password: string;
}

export type SignInRes = UserToken & { data: { user: UserInfo, accessToken: string, refreshToken: string } };
export type RefreshRes = { result: boolean; data: { accessToken: string }; message?: string };

export enum UserApi {
	SignIn = "auth/signin",
	Logout = "auth/logout",
	Refresh = "auth/refresh",
	User = "user",
	Dashboard = "auth/dashboard",
	SetupStatus = "auth/setup/status",
	Setup = "auth/setup",
}

export interface SetupStatus {
	needsSetup: boolean;
}

export interface SetupReq {
	name: string;
	email: string;
	password: string;
	company_name?: string;
	phone?: string;
}

const signin = (data: SignInReq) =>
	apiClient.post<SignInRes>({ url: UserApi.SignIn, data });
const logout = () => apiClient.get({ url: UserApi.Logout });
const findById = (id: string) =>
	apiClient.get<UserInfo[]>({ url: `${UserApi.User}/${id}` });
const refresh = (timestamp: number, refreshToken?: string) =>
	apiClient.get<RefreshRes>({
		url: `${UserApi.Refresh}/${timestamp}`,
		headers: refreshToken ? { Authorization: `Bearer ${refreshToken}` } : undefined,
	});

const getSetupStatus = () =>
	apiClient.get<SetupStatus>({ url: UserApi.SetupStatus });

const completeSetup = (data: SetupReq) =>
	apiClient.post<SignInRes>({ url: UserApi.Setup, data });

export interface DashboardData {
	kpi: {
		weekRequestsCount: number;
		successRate: number;
		avgTimeSeconds: number;
		pendingCount: number;
	};
	statusDistribution: {
		APPROVED: number;
		DENIED: number;
		EXPIRED: number;
		BLOCKED: number;
		CONSUMED: number;
		PENDING: number;
		CREATED: number;
	};
	dailyTrend: Array<{
		day: number;
		count: number;
	}>;
	recentRequests: Array<{
		id: string;
		createdAt: number;
		status: string;
		country: string;
		devicePlatform: string;
		appName: string;
		userIdentifier: string;
	}>;
	riskEvents: {
		NEW_DEVICE: number;
		COUNTRY_CHANGE: number;
		ABUSE: number;
	};
	weekSuccessCount: number;
}

const getDashboard = () =>
	apiClient.get<DashboardData>({ url: UserApi.Dashboard });

export default {
	signin,
	findById,
	logout,
	refresh,
	getDashboard,
	getSetupStatus,
	completeSetup,
};
