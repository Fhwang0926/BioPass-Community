export interface Result<T = any> {
	status: number;
	result: boolean; // 성공 여부	
	message?: string; // 에러 메시지
	data?: T; // 데이터
}

/** 목록 API 통일 응답: data + pagination */
export interface ListResponse<T = unknown> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface BaseSearchParams {
	option: {
		created_sd_at?: string;
		created_ed_at?: string;
		updated_sd_at?: string;
		updated_ed_at?: string;
		offset?: number;
		limit?: number;
	}	
}