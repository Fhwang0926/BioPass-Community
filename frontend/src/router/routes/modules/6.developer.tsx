import { Suspense } from "react";
import { CodeOutlined } from "@ant-design/icons";
import { Navigate, Outlet } from "react-router";

import { CircleLoading } from "@/components/loading";
import type { AppRouteObject } from "#/router";
import { PermissionAccount } from "@/types/enum";
import { safeLazyImport } from "../../utils/lazy-import";

const DeveloperQuickStart = safeLazyImport(() => import("@/pages/developer/quick-start"));
const DeveloperDocs = safeLazyImport(() => import("@/pages/developer/docs"));

const developer: AppRouteObject = {
	order: 2,
	path: "developer",
	element: (
		<Suspense fallback={<CircleLoading />}>
			<Outlet />
		</Suspense>
	),
	meta: {
		label: "sys.menu.developer",
		icon: (
			<CodeOutlined className="ant-menu-item-icon" style={{ fontSize: "24px" }} />
		),
		key: "/developer",
		permissions: [PermissionAccount.ADMIN],
		hideMenu: true, // 그룹은 메뉴에 표시하지 않고 children만 표시
		section: "developer",
	},
	children: [
		{
			index: true,
			element: <Navigate to="quick-start" replace />,
			meta: { key: "/developer", label: "", hideMenu: true },
		},
		{
			path: "quick-start",
			element: <DeveloperQuickStart />,
			meta: { label: "sys.menu.developer.quickStart", key: "/developer/quick-start", permissions: [PermissionAccount.ADMIN, PermissionAccount.USER], hideMenu: false, section: "developer" },
		},
		{
			path: "docs",
			element: <DeveloperDocs />,
			meta: { label: "sys.menu.developer.docs", key: "/developer/docs", permissions: [PermissionAccount.ADMIN, PermissionAccount.USER], hideMenu: false, section: "developer" },
		},
	],
};

export default developer;

