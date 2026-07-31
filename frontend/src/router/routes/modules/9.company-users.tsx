import { Suspense } from "react";

import { Iconify } from "@/components/icon";
import { CircleLoading } from "@/components/loading";

import type { AppRouteObject } from "#/router";
import { PermissionAccount } from "@/types/enum";
import { safeLazyImport } from "../../utils/lazy-import";

const CompanyUsersPage = safeLazyImport(() => import("@/pages/management/user"));

const companyUsers: AppRouteObject = {
	order: 8.5,
	path: "management/users",
	element: (
		<Suspense fallback={<CircleLoading />}>
			<CompanyUsersPage />
		</Suspense>
	),
	meta: {
		label: "sys.menu.user.management.company_account_title",
		icon: <Iconify icon="solar:users-group-rounded-bold" size={24} />,
		key: "/management/users",
		permissions: [PermissionAccount.ADMIN],
		hideMenu: false,
		section: "myInfo",
	},
};

export default companyUsers;
