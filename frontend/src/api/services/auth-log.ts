import apiClient from "../apiClient";

export enum AuthLogApi {
	AuthLog = "sys_auth_log",
	Search = "sys_auth_log/search",
}

export interface AuthLog {
	id: string;
	appId: string;
	userId: string;
	status: 'CREATED' | 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'BLOCKED' | 'CONSUMED';
	requestIp?: string;
	country?: string;
	userAgent?: string;
	expiresAt?: number;
	approvedAt?: number;
	deniedAt?: number;
	createdAt: number;
	maskedUser?: string;
	appName?: string;
	deviceName?: string;
	devicePlatform?: string;
	deviceType?: string; // PC | Mobile | App (이메일 인증 시)
	browserInfo?: string; // User-Agent 문자열 (이메일 인증 시)
}

export interface AuthLogDetail extends AuthLog {
	user?: {
		id: string;
		identifierType: string;
		identifierHash: string;
		status: string;
		email?: string;
		name?: string;
	};
	app?: {
		id: string;
		name: string;
		clientId: string;
	};
	approvedDevice?: {
		id: string;
		platform: string;
		deviceName?: string;
		biometricCapable: boolean;
	};
	timeline: Array<{
		id: string;
		eventType: string;
		detail: any;
		createdAt: number;
	}>;
	blockedByPolicy: boolean;
	riskEvents: Array<{
		id: string;
		riskType: string;
		score?: number;
		action?: string;
		createdAt: number;
	}>;
}

export interface SearchParams {
	status?: 'CREATED' | 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'BLOCKED' | 'CONSUMED';
	app_id?: string;
	user_id?: string;
	country?: string;
	request_ip?: string;
	start_date?: string;
	end_date?: string;
	page?: number;
	limit?: number;
}

export interface AuthLogListResponse {
	data: AuthLog[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}

// 목록 조회 - apiClient가 성공 시 res.data(payload)만 넘김 → { data: [], pagination: {} }
const getAuthLogList = async (params: SearchParams): Promise<AuthLogListResponse> => {
	const raw = await apiClient.post<unknown>({
		url: AuthLogApi.Search,
		data: params,
	});

	const empty: AuthLogListResponse = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
	if (!raw || typeof raw !== "object") return empty;

	const r = raw as Record<string, unknown>;
	// 표준: { data: [], pagination: { page, limit, total, totalPages } }
	if (Array.isArray(r.data) && r.pagination && typeof r.pagination === "object") {
		const pag = r.pagination as Record<string, unknown>;
		return {
			data: r.data as AuthLog[],
			pagination: {
				page: Number(pag.page) || 1,
				limit: Number(pag.limit) || 20,
				total: Number(pag.total) || 0,
				totalPages: Number(pag.totalPages) || 0,
			},
		};
	}
	// 래핑: { result, data: { data, pagination } }
	if (r.result === true && r.data && typeof r.data === "object") {
		const inner = r.data as Record<string, unknown>;
		if (Array.isArray(inner.data) && inner.pagination && typeof inner.pagination === "object") {
			const pag = inner.pagination as Record<string, unknown>;
			return {
				data: inner.data as AuthLog[],
				pagination: {
					page: Number(pag.page) || 1,
					limit: Number(pag.limit) || 20,
					total: Number(pag.total) || 0,
					totalPages: Number(pag.totalPages) || 0,
				},
			};
		}
	}
	// legacy: { rows, total }
	if (Array.isArray(r.rows) && typeof r.total === "number") {
		const rows = r.rows as AuthLog[];
		return {
			data: rows,
			pagination: { page: 1, limit: rows.length, total: r.total, totalPages: Math.ceil(r.total / Math.max(1, rows.length)) },
		};
	}
	return empty;
};

// 상세 조회 (인터셉터가 payload만 반환)
const getAuthLog = (id: string) =>
	apiClient.get<AuthLogDetail>({ url: `${AuthLogApi.AuthLog}/${id}` });

const authLogService = {
	getAuthLogList,
	getAuthLog,
};

export default authLogService;

