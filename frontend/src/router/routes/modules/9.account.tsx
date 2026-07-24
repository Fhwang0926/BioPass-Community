import { Suspense } from "react";

import { Iconify } from "@/components/icon";
import { CircleLoading } from "@/components/loading";

import type { AppRouteObject } from "#/router";
import { PermissionAccount } from "@/types/enum";
import { safeLazyImport } from "../../utils/lazy-import";

const AccountPage = safeLazyImport(() => import("@/pages/management/account"));

const account: AppRouteObject = {
	order: 9,
	path: "management/account",
	element: (
		<Suspense fallback={<CircleLoading />}>
			<AccountPage />
		</Suspense>
	),
	meta: {
		label: "sys.menu.user.account",
		icon: (
			<Iconify icon="solar:user-id-bold" size={24} />
		),
		key: "/management/account",
		permissions: [PermissionAccount.SUPER_ADMIN, PermissionAccount.ADMIN, PermissionAccount.USER],
		hideMenu: false,
		section: "myInfo",
	},
};

export default account;

