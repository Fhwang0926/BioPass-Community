import { useMutation } from "@tanstack/react-query";
// import { useNavigate } from "react-router";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import userService, { type SignInReq } from "@/api/services/auth";
import idleService from "@/api/services/idle";

import { toast } from "sonner";
import type { UserInfo, UserToken } from "#/entity";
import { StorageEnum } from "#/enum";
import { hashClientPassword } from "@/utils/passwordHash";
import { t } from "@/locales/i18n";

type UserStore = {
	userInfo: Partial<UserInfo>;
	userToken: UserToken;
	// 使用 actions 命名空间来存放所有的 action
	actions: {
		setUserInfo: (userInfo: Partial<UserInfo>) => void;
		setUserToken: (token: UserToken) => void;
		clearUserInfoAndToken: () => void;
	};
};

const normalizeUserInfo = (userInfo: Partial<UserInfo> = {}): Partial<UserInfo> => {
	const rawCompanyId = userInfo.company_id ?? userInfo.companyId;
	if (rawCompanyId === undefined || rawCompanyId === null) return userInfo;

	const companyId = Number(rawCompanyId);
	if (!Number.isFinite(companyId)) return userInfo;

	return {
		...userInfo,
		company_id: companyId,
		companyId,
	};
};

const useUserStore = create<UserStore>()(
	persist(
		(set) => ({
			userInfo: {},
			userToken: {},
			actions: {
				setUserInfo: (userInfo) => {
					set({ userInfo: normalizeUserInfo(userInfo) });
				},
				setUserToken: (userToken) => {
					set({ userToken });
				},
				clearUserInfoAndToken() {
					// Destroy idle service before clearing user data
					idleService.destroy();
					set({ userInfo: {}, userToken: {} });
				},
			},
		}),
		{
			name: "userStore", // name of the item in the storage (must be unique)
			storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
			partialize: (state) => ({
				[StorageEnum.UserInfo]: state.userInfo,
				[StorageEnum.UserToken]: state.userToken,
			}),
		},
	),
);

export const useUserInfo = () => useUserStore((state) => normalizeUserInfo(state.userInfo));
export const useUserToken = () => useUserStore((state) => state.userToken);
export const useUserPermission = () =>
	useUserStore((state) => state.userInfo.permissions);
export const useUserActions = () => useUserStore((state) => state.actions);

export const useSignIn = () => {
	const { setUserToken, setUserInfo } = useUserActions();

	const signInMutation = useMutation({
		mutationFn: userService.signin,
	});

	const signIn = async (data: SignInReq) => {
		try {
			// First-pass hash only; server stores with scrypt.
			data.password = hashClientPassword(data.password);
			const res = await signInMutation.mutateAsync(data);
			// 인터셉터가 1depth data만 반환 → 백엔드가 중첩이면 res = { result, data: { user, accessToken, refreshToken } }
			const raw = res as unknown as { user?: UserInfo; accessToken?: string; refreshToken?: string; data?: typeof res };
			const payload = raw?.data != null && typeof raw.data === "object" && "accessToken" in raw.data ? raw.data : raw;
			const { user, accessToken, refreshToken } = payload as { user: UserInfo; accessToken: string; refreshToken: string };
			if (!accessToken) throw new Error("Login response missing accessToken");
			setUserToken({ accessToken, refreshToken });
			setUserInfo(user ?? {});
			// 토큰을 넘겨서 즉시 시작 (getState 타이밍 이슈 방지)
			idleService.start(accessToken);
			toast.success(t("sys.login.signInSuccess"));
		} catch (err) {
			toast.error((err as Error).message, {
				position: "top-center",
			});
			throw err;
		}
	};

	return signIn;
};

export default useUserStore;
