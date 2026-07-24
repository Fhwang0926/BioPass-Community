import apiClient from "../apiClient";

import { BaseSearchParams } from "@/types/api";

export enum UserDeviceApi {
	Users = "sys_user_device/users",
	Devices = "sys_user_device/devices",
}

export interface User {
	id: string;
	identifierType: 'email' | 'phone';
	identifierHash: string;
	/** 이메일/연락처 원문 (app_users.identifier_value) */
	identifierValue?: string | null;
	status: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'INACTIVE';
	lastLoginAt?: number;
	createdAt: number;
	deviceCount?: number;
	/** 표시용 식별자 (identifierValue 또는 identifierHash) */
	identifier?: string;
}

export interface UserDetail extends User {
	devices: Device[];
	authHistory: Array<{
		id: string;
		appId: string;
		status: string;
		requestIp?: string;
		country?: string;
		createdAt: number;
	}>;
}

export interface Device {
	id: string;
	userId: string;
	platform: 'ios' | 'android' | 'web';
	deviceName?: string;
	pushToken?: string;
	biometricCapable: boolean;
	trustedUntil?: number;
	revokedAt?: number;
	lastSeenAt?: number;
	createdAt: number;
	user?: {
		id: string;
		identifierType: string;
		identifierHash: string;
		identifierValue?: string | null;
	};
	isRevoked?: boolean;
	isTrusted?: boolean;
}

export interface UserSearchParams extends BaseSearchParams {
	status?: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED';
	identifier_type?: 'email' | 'phone';
	page?: number;
	limit?: number;
}

export interface DeviceSearchParams extends BaseSearchParams {
	user_id?: string;
	platform?: 'ios' | 'android' | 'web';
	revoked?: boolean;
	page?: number;
	limit?: number;
}

export interface UserListResponse {
	data: User[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}

// 사용자 목록 조회. 인터셉터가 응답의 data 필드를 반환함.
const getUserList = (params: UserSearchParams) => 
	apiClient.post<UserListResponse>({ 
		url: `${UserDeviceApi.Users}/search`, 
		data: params 
	});

// 사용자 상세 조회 (apiClient가 이미 내부 data로 반환)
const getUser = (id: string) => 
	apiClient.get<UserDetail>({ 
		url: `${UserDeviceApi.Users}/${id}` 
	});

// 모든 디바이스 로그아웃
const logoutAllDevices = (userId: string) => 
	apiClient.post<{ result: boolean }>({ 
		url: `${UserDeviceApi.Users}/${userId}/logout-all` 
	});

// 사용자 차단
const blockUser = (userId: string, blockUntil?: string) => 
	apiClient.post<{ result: boolean }>({ 
		url: `${UserDeviceApi.Users}/${userId}/block`,
		data: { block_until: blockUntil }
	});

// 사용자 차단 해제
const unblockUser = (userId: string) => 
	apiClient.post<{ result: boolean }>({ 
		url: `${UserDeviceApi.Users}/${userId}/unblock` 
	});

export interface DeviceListResponse {
	data: Device[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}

// 디바이스 목록 조회. 인터셉터가 응답의 data 필드를 반환함.
const getDeviceList = (params: DeviceSearchParams) => 
	apiClient.post<DeviceListResponse>({ 
		url: `${UserDeviceApi.Devices}/search`, 
		data: params 
	});

// 디바이스 강제 revoke
const revokeDevice = (deviceId: string) => 
	apiClient.post<{ result: boolean }>({ 
		url: `${UserDeviceApi.Devices}/${deviceId}/revoke` 
	});

const userDeviceService = {
	getUserList,
	getUser,
	logoutAllDevices,
	blockUser,
	unblockUser,
	getDeviceList,
	revokeDevice,
};

export default userDeviceService;

