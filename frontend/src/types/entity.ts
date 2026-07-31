import type { BasicStatus, PermissionType } from "./enum";

export interface UserToken {
	accessToken?: string;
	refreshToken?: string;
}

export interface UserInfo {
	id: string;
	email: string;
	name: string;
	password?: string;
	avatar?: string;
	role?: Role;
	status?: BasicStatus;
	permissions: string;
	company_id?: number;
	companyId?: number;
	is_admin?: boolean;
	isAdmin?: boolean;
}

export interface Organization {
	id: string;
	name: string;
	status: "enable" | "disable";
	desc?: string;
	order?: number;
	children?: Organization[];
}

export interface Company {
	id: number;
	name: string;
	code?: string;
	business_no?: string;
	email?: string;
	thumbnail?: string;
	is_active: boolean;
	created_at?: Date;
	updated_at?: Date;
}

export interface Permission {
	id: string;
	parentId: string;
	name: string;
	label: string;
	type: PermissionType;
	route: string;
	status?: BasicStatus;
	order?: number;
	icon?: string;
	component?: string;
	hide?: boolean;
	hideTab?: boolean;
	frameSrc?: URL;
	newFeature?: boolean;
	children?: Permission[];
}

export interface Role {
	id: string;
	name: string;
	label: string;
	status: BasicStatus;
	order?: number;
	desc?: string;
	permission?: Permission[];
}

export interface User {
	id: number;
	email: string;
	password: string;
	name: string;
	phone?: string;
	/** SHA512 hash of phone (backend returns as phoneSha512) */
	phone_sha512?: string;
	phoneSha512?: string;
	permissions: 'user' | 'admin' | 'USER' | 'ADMIN';
	company_id?: number;
	is_active: boolean;
	is_verify: boolean;
	is_admin: boolean;
	is_del: boolean;
	created_at?: Date;
	updated_at?: Date;
	last_visited_at?: Date;
	thumbnail?: string;
}

export interface SysSetting {
	id: number;
	is_publish: boolean;
	code: string;
	data: string;
	created_at: string;
	updated_at: string;
}

export interface LogAlarm {
	id: number;
	user_id: number;
	company_id: number | null;
	type: 'system' | 'payment' | 'security' | 'usage' | 'maintenance' | 'custom';
	title: string;
	content: string;
	priority: 'low' | 'medium' | 'high' | 'urgent';
	is_read: boolean;
	read_at: string | null;
	action_url: string | null;
	action_text: string | null;
	metadata: any | null;
	is_email_sent: boolean;
	email_sent_at: string | null;
	is_push_sent: boolean;
	push_sent_at: string | null;
	expires_at: string | null;
	created_at: string;
	updated_at: string;
}
