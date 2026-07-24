import { BaseSearchParams, type ListResponse } from "@/types/api";
import apiClient from "../apiClient";

// Log Mail API
export enum LogMailApi {
  LogMail = "log_mail",
  Search = "log_mail/search",
}

export interface LogMailSearchParams extends BaseSearchParams {
  title?: string;
  content?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  from?: string;
  from_name?: string;
  is_done?: boolean;
  is_clear?: boolean;
  is_html?: boolean;
  uuid?: string;
  error_msg?: string;
  sent_at?: string;
}

export interface CreateLogMailParams {
  from: string;
  to?: string;
  cc?: string;
  bcc?: string;
  title?: string;
  content?: string;
  from_name?: string;
  is_html?: boolean;
  uuid?: string;
}

export interface UpdateLogMailParams extends Partial<CreateLogMailParams> {
  id: number;
  is_done?: boolean;
  is_clear?: boolean;
  error_msg?: string;
  sent_at?: string;
}

// Log Audit API
export enum LogAuditApi {
  LogAudit = "log_audit",
  Search = "log_audit/search",
}

export interface LogAuditSearchParams extends BaseSearchParams {
  action?: string;
  status?: string;
  description?: string;
  request_path?: string;
  request_method?: string;
  ip_address?: string;
  user_agent?: string;
  response_time_min?: number;
  response_time_max?: number;
  user_id?: number | number[];
  username?: string;
}

export interface CreateLogAuditParams {
  action: string;
  status: string;
  description?: string;
  request_body?: string;
  response_body?: string;
  response_time?: number;
}

export interface UpdateLogAuditParams {
  id: number;
}

// Log Mail Service - 백엔드 통일 응답 { data, pagination }
const getLogMailList = (params: LogMailSearchParams) =>
  apiClient.post<ListResponse>({ url: LogMailApi.Search, data: params });

const getLogMail = (id: number) =>
  apiClient.get<any>({ url: `${LogMailApi.LogMail}/${id}` });

const createLogMail = (data: CreateLogMailParams) =>
  apiClient.post<any>({ url: `${LogMailApi.LogMail}/create`, data });

const updateLogMail = (data: UpdateLogMailParams) =>
  apiClient.patch<any>({
    url: `${LogMailApi.LogMail}/${data.id}`,
    data: { ...data, id: undefined },
  });

const deleteLogMail = (id: number) =>
  apiClient.delete<{ result: boolean; data: any }>({
    url: `${LogMailApi.LogMail}/${id}`,
  });

// Log Audit Service
const getLogAuditList = (params: LogAuditSearchParams) =>
  apiClient.post<{ result: boolean; data: { total: number; rows: any[] } }>({
    url: LogAuditApi.Search,
    data: params ,
  });

const getLogAudit = (id: number) =>
  apiClient.get<any>({ url: `${LogAuditApi.LogAudit}/${id}` });

const createLogAudit = (data: CreateLogAuditParams) =>
  apiClient.post<any>({ url: `${LogAuditApi.LogAudit}/create`, data });

const updateLogAudit = (data: UpdateLogAuditParams) =>
  apiClient.patch<any>({
    url: `${LogAuditApi.LogAudit}/${data.id}`,
    data: { ...data, id: undefined },
  });

const deleteLogAudit = (id: number) =>
  apiClient.delete<{ result: boolean; data: any }>({
    url: `${LogAuditApi.LogAudit}/${id}`,
  });

import type { LogAlarm } from '@/types/entity';

export enum AlarmApi {
    Alarm = 'log_alarm',
    Search = 'log_alarm/search',
}

export interface LogAlarmSearchParams extends BaseSearchParams {
    user_id?: number;
    company_id?: number;
    type?: string;
    is_read?: boolean;
    priority?: string;
}

export interface CreateAlarmParams {
    user_id: number;
    company_id?: number;
    type: LogAlarm['type'];
    title: string;
    content: string;
    priority: LogAlarm['priority'];
    action_url?: string;
    action_text?: string;
    metadata?: any;
    expires_at?: string;
}

export interface UpdateAlarmParams extends Partial<CreateAlarmParams> {
    id: number;
    is_read?: boolean;
    read_at?: string;
}

// 목록 조회 - 백엔드 통일 응답 { data, pagination }
const getAlarmList = (params: LogAlarmSearchParams) =>
  apiClient.post<ListResponse<LogAlarm>>({ url: AlarmApi.Search, data: params });

// 단일 조회
const getAlarm = (id: number) => 
    apiClient.get<LogAlarm>({ url: `${AlarmApi.Alarm}/${id}` });

// 생성
const createAlarm = (data: CreateAlarmParams) => 
    apiClient.post<LogAlarm>({ url: `${AlarmApi.Alarm}/create`, data });

// 수정
const updateAlarm = (data: UpdateAlarmParams) => 
    apiClient.patch<LogAlarm>({ 
        url: `${AlarmApi.Alarm}/${data.id}`, 
        data: { ...data, id: undefined } 
    });

// 삭제
const deleteAlarm = (id: number) => 
    apiClient.delete<{ result: boolean; data: string }>({ 
        url: `${AlarmApi.Alarm}/${id}` 
    });

export default {
  // Log Mail
  getLogMailList,
  getLogMail,
  createLogMail,
  updateLogMail,
  deleteLogMail,

  // Log Audit
  getLogAuditList,
  getLogAudit,
  createLogAudit,
  updateLogAudit,
  deleteLogAudit,

  // Log Alarm
  getAlarmList,
  getAlarm,
  createAlarm,
  updateAlarm,
  deleteAlarm,
};
