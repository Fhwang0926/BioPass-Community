import { Suspense } from "react";
import { Navigate, Outlet } from "react-router";

import { SvgIcon } from "@/components/icon";
import { CircleLoading } from "@/components/loading";

import type { AppRouteObject } from "#/router";
import { PermissionAccount } from "@/types/enum";
import { safeLazyImport } from "../../utils/lazy-import";

const UserDevicePage = safeLazyImport(() => import("@/pages/user-device"));
const UserDeviceDetail = safeLazyImport(() => import("@/pages/user-device/detail"));
const DeviceManagementPage = safeLazyImport(() => import("@/pages/user-device/devices"));

const userManagement: AppRouteObject = {
	order: 3,
	path: "user-management",
	element: (
		<Suspense fallback={<CircleLoading />}>
			<Outlet />
		</Suspense>
	),
	meta: {
		label: "sys.menu.userManagement",
		icon: (
			<SvgIcon icon="ic-management" className="ant-menu-item-icon" size="24" />
		),
		key: "/user-management",
		permissions: [PermissionAccount.ADMIN],
		hideMenu: false, // 메뉴에 표시하고 children을 드롭다운으로 표시
		section: "service", // 서비스 섹션에 포함
	},
	children: [
		{
			index: true,
			element: <Navigate to="users" replace />,
			meta: { key: "/user-management", label: "", hideMenu: true },
		},
		{
			path: "users",
			element: <UserDevicePage />,
			meta: { 
				label: "sys.menu.userDevice.users", 
				key: "/user-management/users", 
				permissions: [PermissionAccount.ADMIN], 
				hideMenu: false,
				section: "service", // 서비스 섹션에 포함
			},
		},
		{
			path: "users/:id",
			element: <UserDeviceDetail />,
			meta: { 
				label: "sys.menu.userDevice.userDetail", 
				key: "/user-management/users/:id", 
				hideMenu: true 
			},
		},
		{
			path: "devices",
			element: <DeviceManagementPage />,
			meta: { 
				label: "sys.menu.userDevice.devices", 
				key: "/user-management/devices", 
				permissions: [PermissionAccount.ADMIN], 
				hideMenu: false,
				section: "service", // 서비스 섹션에 포함
			},
		},
	],
};

export default userManagement;

