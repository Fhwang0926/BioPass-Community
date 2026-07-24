import apiClient from "../apiClient";

import type { User } from "#/entity";
import { BaseSearchParams } from "@/types/api";

type UserPermission = 'user' | 'admin' | 'USER' | 'ADMIN';

export enum UserApi {
	User = "sys_user",
	Search = "sys_user/search",
	Profile = "sys_profile",
}

export interface SearchParams extends BaseSearchParams {
	email?: string;
	name?: string;
	phone?: string;
	is_active?: boolean;
	is_verify?: boolean;
	permissions?: UserPermission;
	company_id?: number;
}

export interface CreateUserParams {
	email: string;
	password?: string;
	name?: string;
	phone?: string;
	permissions?: UserPermission;
	company_id?: number;
	is_active?: boolean;
	is_verify?: boolean;
}

export interface InviteUserParams {
	email: string;
	name?: string;
	phone?: string;
	permissions?: UserPermission;
	company_id?: number;
}

export interface InviteUserResponse {
	user: User;
	invitation: {
		email_sent: boolean;
		mail_log_id: number | null;
		error?: string | null;
		temporary_password?: string;
	};
}

export interface UpdateUserParams extends Partial<CreateUserParams> {
	id: number;
	new_password?: string;
}

export interface UpdateProfileParams {
	name?: string;
	phone?: string;
	password?: string;
	password_new?: string;
	company?: {
		name: string;
	};
}

// 목록 조회 - 백엔드 통일 응답 { data, pagination } → 호환용 { data, total }
export interface UserListResponse {
	data: User[];
	total: number;
}

export type ProfileResponse = User & { group: { name: string | null } };
const normalizeUser = (user: any): User => {
	if (!user || typeof user !== "object") return user;
	return {
		...user,
		company_id: user.company_id ?? user.companyId,
		is_active: user.is_active ?? user.isActive,
		is_verify: user.is_verify ?? user.isVerify,
		is_admin: user.is_admin ?? user.isAdmin,
		is_del: user.is_del ?? user.isDel,
		phone_sha512: user.phone_sha512 ?? user.phoneSha512,
		created_at: user.created_at ?? user.createdAt,
		updated_at: user.updated_at ?? user.updatedAt,
		last_visited_at: user.last_visited_at ?? user.lastVisitedAt,
	} as User;
};

const stripRoleDerivedFields = <T extends object>(data: T) => {
	const { is_admin, isAdmin, ...rest } = data as T & { is_admin?: unknown; isAdmin?: unknown };
	return rest;
};

const getUserList = async (params: SearchParams): Promise<UserListResponse> => {
	const res = await apiClient.post<{ data: User[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>({
		url: UserApi.Search,
		data: params,
	});
	if (res && typeof res === "object" && "data" in res && "pagination" in res) {
		const p = (res as { data: User[]; pagination: { total: number } }).pagination;
		return { data: ((res as { data: User[] }).data ?? []).map(normalizeUser), total: p?.total ?? 0 };
	}
	return { data: [], total: 0 };
};

// 단일 조회
const getUser = async (id: number) =>
	normalizeUser(await apiClient.get<User>({ url: `${UserApi.User}/${id}` }));

// 생성
const createUser = async (data: CreateUserParams) =>
	normalizeUser(await apiClient.post<User>({ url: `${UserApi.User}/create`, data: stripRoleDerivedFields(data) }));

// 기업 사용자 초대
const inviteUser = async (data: InviteUserParams): Promise<InviteUserResponse> => {
	const res = await apiClient.post<InviteUserResponse>({ url: `${UserApi.User}/invite`, data: stripRoleDerivedFields(data) });
	return {
		...res,
		user: normalizeUser(res.user),
	};
};

// 수정
const updateUser = async (data: UpdateUserParams) =>
	normalizeUser(await apiClient.patch<User>({
		url: `${UserApi.User}/${data.id}`,
		data: stripRoleDerivedFields({ ...data, id: undefined })
	}));

// 삭제 (인터셉터가 payload만 반환) — 관리자용
const deleteUser = (id: number) =>
	apiClient.delete<unknown>({ url: `${UserApi.User}/${id}` });

// 본인 계정 삭제 (자기 프로필)
const deleteProfile = (id: number) =>
	apiClient.delete<unknown>({ url: `${UserApi.Profile}/${id}` });

// 프로필 조회 (인터셉터가 payload만 반환)
const getProfile = async () =>
	normalizeUser(await apiClient.get<ProfileResponse>({ url: UserApi.Profile })) as ProfileResponse;

// 프로필 수정 (인터셉터가 payload만 반환)
const updateProfile = (data: UpdateProfileParams) =>
	apiClient.post<User>({ url: UserApi.Profile, data });

export default {
	getUserList,
	getUser,
	createUser,
	inviteUser,
	updateUser,
	deleteUser,
	deleteProfile,
	getProfile,
	updateProfile,
};
