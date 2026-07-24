import apiClient from "../apiClient";

import type { Company } from "#/entity";
import { BaseSearchParams, type ListResponse } from "@/types/api";

export enum CompanyApi {
	Company = "sys_company",
	Search = "sys_company/search",
}

export interface SearchParams extends BaseSearchParams {
	name?: string;
	code?: string;
	business_no?: string;
	email?: string;
	is_active?: boolean;
}

export interface CreateCompanyParams {
	name: string;
	code?: string;
	business_no?: string;
	thumbnail?: string;
	email?: string;
}

export interface UpdateCompanyParams extends Partial<CreateCompanyParams> {
	id: number;
}

const normalizeCompany = (company: any): Company => {
	if (!company || typeof company !== "object") return company;
	return {
		...company,
		business_no: company.business_no ?? company.businessNo,
		is_active: company.is_active ?? company.isActive,
		is_del: company.is_del ?? company.isDel,
		created_at: company.created_at ?? company.createdAt,
		updated_at: company.updated_at ?? company.updatedAt,
	} as Company;
};

const getCompanyList = async (params: SearchParams): Promise<ListResponse<Company>> => {
	const res = await apiClient.post<ListResponse<Company>>({ url: CompanyApi.Search, data: params });
	return {
		...res,
		data: Array.isArray(res?.data) ? res.data.map(normalizeCompany) : [],
	};
};

const getCompany = async (id: number) =>
	normalizeCompany(await apiClient.get<Company>({ url: `${CompanyApi.Company}/${id}` }));

const createCompany = async (data: CreateCompanyParams) =>
	normalizeCompany(await apiClient.post<Company>({ url: `${CompanyApi.Company}/create`, data }));

const updateCompany = async (data: UpdateCompanyParams) =>
	normalizeCompany(await apiClient.patch<Company>({ url: `${CompanyApi.Company}/${data.id}`, data: { ...data, id: undefined } }));

const deleteCompany = (id: number) =>
	apiClient.delete<unknown>({ url: `${CompanyApi.Company}/${id}` });

export default {
	getCompanyList,
	getCompany,
	createCompany,
	updateCompany,
	deleteCompany,
};
