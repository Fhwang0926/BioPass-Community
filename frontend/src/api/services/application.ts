import apiClient from "../apiClient";

export enum ApplicationApi {
	Application = "sys_application",
	Search = "sys_application/search",
	RegenerateSecret = "sys_application/:id/regenerate-secret",
}

export interface Application {
	id: number;
	name: string;
	clientId: string;
	clientSecret?: string; // 생성 시에만 반환
	callbackUrl?: string; // 인증 완료 후 리다이렉트할 URL
	companyId?: number;
	userId?: number;
	isActive: boolean;
	loginIdentifier: 'email' | 'phone' | 'both';
	authRequestExpiry: number;
	duplicateRequestLimit: number;
	lastAuthRequestAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface SearchParams {
	name?: string;
	client_id?: string;
	is_active?: boolean;
	page?: number;
	limit?: number;
}

export interface CreateApplicationParams {
	name: string;
	client_id?: string;
	callback_url?: string; // 인증 완료 후 리다이렉트할 URL
	company_id?: number;
	user_id?: number;
	is_active?: boolean;
	login_identifier?: 'email' | 'phone' | 'both';
	auth_request_expiry?: number;
	duplicate_request_limit?: number;
}

export interface UpdateApplicationParams extends Partial<CreateApplicationParams> {
	id: number;
}

export interface ApplicationListResponse {
	data: Application[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}

// 목록 조회 (검색 + 페이지네이션). 인터셉터가 응답의 data 필드를 반환함.
const getApplicationList = (params: SearchParams) => 
	apiClient.post<ApplicationListResponse>({ 
		url: ApplicationApi.Search, 
		data: params 
	});

// 단일 조회 (인터셉터가 payload만 반환)
const getApplication = (id: number) =>
	apiClient.get<Application>({ url: `${ApplicationApi.Application}/${id}` });

// 생성 (인터셉터가 payload만 반환)
const createApplication = (params: CreateApplicationParams) =>
	apiClient.post<Application>({ url: `${ApplicationApi.Application}/create`, data: params });

// 수정 (인터셉터가 payload만 반환)
const updateApplication = (params: UpdateApplicationParams) =>
	apiClient.put<Application>({ url: `${ApplicationApi.Application}/${params.id}`, data: params });

// 삭제 (인터셉터가 payload만 반환)
const deleteApplication = (id: number) =>
	apiClient.delete<unknown>({ url: `${ApplicationApi.Application}/${id}` });

// Client Secret 재발급
// apiClient 인터셉터가 data만 반환하므로, 반환 타입은 Application
const regenerateSecret = (id: number) => 
	apiClient.post<Application>({ 
		url: ApplicationApi.RegenerateSecret.replace(':id', id.toString())
	});

const applicationService = {
	getApplicationList,
	getApplication,
	createApplication,
	updateApplication,
	deleteApplication,
	regenerateSecret,
};

export default applicationService;
