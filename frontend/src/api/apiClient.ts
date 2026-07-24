import axios, { type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";

import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import userService from "./services/auth";

import { toast } from "sonner";
import type { Result } from "#/api";
// import { ResultEnum } from "#/enum";

// Create axios instance (baseURL 미설정 시 프록시 /api 사용 → Vite proxy가 백엔드로 전달)
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_APP_BASE_API ?? "/api",
    timeout: 10000, // 기본 타임아웃 10초
    headers: { "Content-Type": "application/json;charset=utf-8" },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        // Get the current state from userStore
        const userToken = userStore.getState().userToken;
        config.headers = config.headers ?? {};
        if(userToken?.accessToken && !(config.headers as any).Authorization) {
            config.headers.Authorization = `Bearer ${userToken.accessToken}`;
        }
        return config;
    },
    (error) => {
        // Do something with request error
        return Promise.reject(error);
    },
);

// 동시 401 발생 시 refresh 중복 호출 방지
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
    failedQueue = [];
};

// Response Interceptor: 성공 시 res.data를 한 단계만 풀어서 반환 (result/data 규격 통일)
axiosInstance.interceptors.response.use(
    (res: AxiosResponse<Result>) => {
        if (!res.data) throw new Error(t("sys.api.apiRequestFailed"));

        const { result, data, message } = res.data;
        if (result === true) {
            // 항상 data 필드 한 단계만 언래핑 (단일 리소스 → entity, 목록 → { data, pagination })
            return { ...res, data } as AxiosResponse<Result>;
        }

        throw new Error(message || t("sys.api.apiRequestFailed"));
    },
    async (error: AxiosError<Result>) => {
        const { response, message } = error || {};
        const isNetworkError = !response && (message === "Network Error" || (error as any)?.code === "ERR_NETWORK");
        const errMsg = isNetworkError
            ? t("sys.api.networkExceptionMsg")
            : (response?.data?.message || message || t("sys.api.errorMessage"));

        if (response?.status === 401 && error.config) {
            const originalRequest = error.config;

            // 이미 refresh 중이면 큐에 쌓아두고 대기
            if (isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axiosInstance(originalRequest);
                });
            }

            isRefreshing = true;

            try {
                const refreshToken = userStore.getState().userToken?.refreshToken;
                if (!refreshToken) throw new Error("No refresh token available");

                const refreshResponse = await userService.refresh(Date.now(), refreshToken);
                const newAccessToken = (refreshResponse as { accessToken?: string })?.accessToken;
                if (!newAccessToken) throw new Error("Failed to refresh token");

                userStore.getState().actions.setUserToken({
                    ...userStore.getState().userToken,
                    accessToken: newAccessToken,
                });

                processQueue(null, newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                userStore.getState().actions.clearUserInfoAndToken();
                toast.error(t("sys.api.tokenExpired"), { position: "top-center" });
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        toast.error(errMsg, { position: "top-center" });
        throw error;
    },
);

class APIClient {
    
    // private isRefreshing = false;
    // private failedQueue: Array<{
    //     resolve: (value?: any) => void;
    //     reject: (error?: any) => void;
    // }> = [];

    // private processQueue(error: any = null) {
    //     this.failedQueue.forEach((prom) => {
    //         if (error) {
    //             prom.reject(error);
    //         } else {
    //             prom.resolve();
    //         }
    //     });

    //     this.failedQueue = [];
    // }

    // private async handleTokenRefresh(error: AxiosError) {
    //     try {
    //         const refreshToken = userStore.getState().userToken?.refreshToken;
            
    //         if (!refreshToken) {
    //             throw new Error('No refresh token available');
    //         }

    //         if (this.isRefreshing) {
    //             return new Promise((resolve, reject) => {
    //                 this.failedQueue.push({ resolve, reject });
    //             });
    //         }

    //         this.isRefreshing = true;

    //         const response = await axiosInstance.post('/api/auth/refresh', {
    //             refreshToken
    //         });

    //         const { accessToken, refreshToken: newRefreshToken } = response.data.data;
            
    //         // Update tokens in store
    //         userStore.getState().actions.setUserToken({
    //             accessToken,
    //             refreshToken: newRefreshToken,
    //         });
            
    //         // Update axios default headers
    //         axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            
    //         this.isRefreshing = false;
    //         this.processQueue();

    //         return axiosInstance(error.config!);

    //     } catch (err) {
    //         this.isRefreshing = false;
    //         this.processQueue(err);
    //         userStore.getState().actions.clearUserInfoAndToken();
    //         throw err;
    //     }
    // }

    get<T = any>(config: AxiosRequestConfig): Promise<T> {
        return this.request({ ...config, method: "GET" });
    }

    post<T = any>(config: AxiosRequestConfig): Promise<T> {
        return this.request({ ...config, method: "POST" });
    }

    put<T = any>(config: AxiosRequestConfig): Promise<T> {
        return this.request({ ...config, method: "PUT" });
    }

    patch<T = any>(config: AxiosRequestConfig): Promise<T> {
        return this.request({ ...config, method: "PATCH" });
    }

    delete<T = any>(config: AxiosRequestConfig): Promise<T> {
        return this.request({ ...config, method: "DELETE" });
    }

    request<T = any>(config: AxiosRequestConfig): Promise<T> {
        return new Promise((resolve, reject) => {
            // 개별 요청의 timeout 설정 (config에 timeout이 있으면 사용, 없으면 기본값 사용)
            const requestConfig = {
                ...config,
                timeout: config.timeout || axiosInstance.defaults.timeout || 10000
            };
            
            axiosInstance
                .request<any, AxiosResponse<Result>>(requestConfig)
                .then((res: AxiosResponse<Result>) => {
                    resolve((res?.data ?? res) as unknown as T);
                })
                .catch((e: Error | AxiosError) => {
                    reject(e);
                });
        });
    }
}

export default new APIClient();
