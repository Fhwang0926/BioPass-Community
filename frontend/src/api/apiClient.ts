import axios, { type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";

import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import userService from "./services/auth";

import { toast } from "sonner";
import type { Result } from "#/api";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_APP_BASE_API ?? "/api",
    timeout: 10000,
    headers: { "Content-Type": "application/json;charset=utf-8" },
});

/** Translate stable API error codes; fall back to English message. */
function resolveApiErrorMessage(payload?: Partial<Result> | null, fallback?: string): string {
    const code = payload?.code;
    if (code) {
        const key = `sys.api.errors.${code}`;
        const translated = t(key);
        if (translated && translated !== key) return translated;
    }
    return payload?.message || fallback || t("sys.api.errorMessage");
}

axiosInstance.interceptors.request.use(
    (config) => {
        const userToken = userStore.getState().userToken;
        config.headers = config.headers ?? {};
        if (userToken?.accessToken && !(config.headers as any).Authorization) {
            config.headers.Authorization = `Bearer ${userToken.accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
    failedQueue = [];
};

axiosInstance.interceptors.response.use(
    (res: AxiosResponse<Result>) => {
        if (!res.data) throw new Error(t("sys.api.apiRequestFailed"));

        const { result, data, message, code } = res.data as Result;
        if (result === true) {
            return { ...res, data } as AxiosResponse<Result>;
        }

        throw new Error(resolveApiErrorMessage({ message, code }, t("sys.api.apiRequestFailed")));
    },
    async (error: AxiosError<Result>) => {
        const { response, message } = error || {};
        const isNetworkError = !response && (message === "Network Error" || (error as any)?.code === "ERR_NETWORK");
        const status = response?.status;
        const statusKey =
            status === 401
                ? "sys.api.errMsg401"
                : status === 403
                    ? "sys.api.errMsg403"
                    : status === 404
                        ? "sys.api.errMsg404"
                        : status === 408
                            ? "sys.api.errMsg408"
                            : status === 500
                                ? "sys.api.errMsg500"
                                : status === 502
                                    ? "sys.api.errMsg502"
                                    : status === 503
                                        ? "sys.api.errMsg503"
                                        : status === 504
                                            ? "sys.api.errMsg504"
                                            : null;
        const errMsg = isNetworkError
            ? t("sys.api.networkExceptionMsg")
            : resolveApiErrorMessage(
                response?.data,
                (statusKey ? t(statusKey) : undefined) || message || t("sys.api.errorMessage"),
            );

        if (response?.status === 401 && error.config) {
            const originalRequest = error.config;

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
