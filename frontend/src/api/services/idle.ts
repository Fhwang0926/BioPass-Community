import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import { toast } from "sonner";
import apiClient from "../apiClient";
import { replace } from "react-router";

class IdleService {
    private readonly IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    private readonly WARNING_TIMEOUT = 1 * 60 * 1000; // 1 minute
    private idleTimer: number | null = null;
    private warningTimer: number | null = null;
    private isWarningShown = false;
    private countdownInterval: number | null = null;
    private isInitialized = false;
    private resetTimersHandler: () => void;
    private isSubscribed = false;

    constructor() {
        // 초기화는 하지 않고, start() 메서드를 통해 명시적으로 시작
        this.resetTimersHandler = this.resetTimersAndStartTimer.bind(this);
    }

    private resetTimersAndStartTimer() {
        this.resetTimers();
        this.startIdleTimer();
    }

    public start(accessToken?: string) {
        const token = accessToken ?? userStore.getState().userToken?.accessToken;
        if (!token) {
            return;
        }

        if (!this.isSubscribed) {
            userStore.subscribe((state) => {
                const t = state.userToken?.accessToken;
                t ? this.start(t) : this.destroy();
            });
            this.isSubscribed = true;
        }

        if (this.isInitialized) {
            console.log('Idle service already running');
            return;
        }

        console.log('Starting idle service with token');
        this.isInitialized = true;
        this.setupIdleDetection();
    }

    private setupIdleDetection() {
        // Add event listeners for user activity
        window.addEventListener("mousemove", this.resetTimersHandler);
        window.addEventListener("mousedown", this.resetTimersHandler);
        window.addEventListener("keypress", this.resetTimersHandler);
        window.addEventListener("touchmove", this.resetTimersHandler);
        window.addEventListener("scroll", this.resetTimersHandler);

        // Start the initial timer
        this.startIdleTimer();
    }

    private startIdleTimer() {
        this.resetTimers();

        // console.log('Starting idle timer:', new Date().toLocaleTimeString());
        this.idleTimer = window.setTimeout(() => {
            console.log('Idle timeout reached:', new Date().toLocaleTimeString());
            this.showWarning();
        }, this.IDLE_TIMEOUT);

        // Start countdown logging
        this.startCountdownLogging(this.IDLE_TIMEOUT);
    }

    private startCountdownLogging(duration: number) {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        const startTime = Date.now();
        const endTime = startTime + duration;

        this.countdownInterval = window.setInterval(() => {
            const remaining = Math.max(0, endTime - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            console.log(`Idle timer: ${minutes}m ${seconds}s remaining`);
        }, 1000);
    }

    private showWarning() {
        if (this.isWarningShown) return;

        console.log('Showing warning:', new Date().toLocaleTimeString());
        this.isWarningShown = true;
        toast.warning(t("sys.api.sessionExpiring"), {
            position: "top-center",
            duration: this.WARNING_TIMEOUT,
            action: {
                label: t("sys.api.stayLoggedIn"),
                onClick: () => this.extendSession(),
            },
        });

        // Start warning countdown logging
        this.startCountdownLogging(this.WARNING_TIMEOUT);

        this.warningTimer = window.setTimeout(() => {
            console.log('Warning timeout reached, logging out:', new Date().toLocaleTimeString());
            this.logout();
        }, this.WARNING_TIMEOUT);
    }

    private resetTimers() {
        if (this.idleTimer) {
            window.clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.warningTimer) {
            window.clearTimeout(this.warningTimer);
            this.warningTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.isWarningShown = false;
    }

    private async extendSession() {
        try {
            console.log('Extending session:', new Date().toLocaleTimeString());
            await this.refreshToken();
            this.resetTimers();
            this.startIdleTimer();
            toast.success(t("sys.api.sessionExtended"));
        } catch (error) {
            console.error('Failed to extend session:', error);
            this.logout();
        }
    }

    public async refreshToken() {
        const userToken = userStore.getState().userToken;
        if (!userToken?.refreshToken) {
            throw new Error("No refresh token available");
        }

        try {
            console.log('Refreshing token:', new Date().toLocaleTimeString());
            const timestamp = Date.now();
            const response = await apiClient.get<{ accessToken: string }>({
                url: `auth/refresh/${timestamp}`,
                headers: {
                    Authorization: `Bearer ${userToken.refreshToken}`
                }
            });

            // apiClient 인터셉터가 result.data만 반환하므로 response = { accessToken }
            if (response?.accessToken) {
                userStore.getState().actions.setUserToken({
                    ...userStore.getState().userToken,
                    accessToken: response.accessToken
                });
                console.log('Token refreshed successfully');
                return response;
            }
            throw new Error("Failed to refresh token");
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }

    private logout() {
        console.log('Logging out:', new Date().toLocaleTimeString());
        this.resetTimers();
        userStore.getState().actions.clearUserInfoAndToken();
        replace("/login");
    }

    public destroy() {
        console.log('Destroying idle service:', new Date().toLocaleTimeString());
        this.resetTimers();
        this.isInitialized = false;
        window.removeEventListener("mousemove", this.resetTimersHandler);
        window.removeEventListener("mousedown", this.resetTimersHandler);
        window.removeEventListener("keypress", this.resetTimersHandler);
        window.removeEventListener("touchmove", this.resetTimersHandler);
        window.removeEventListener("scroll", this.resetTimersHandler);
    }
}

export default new IdleService();
