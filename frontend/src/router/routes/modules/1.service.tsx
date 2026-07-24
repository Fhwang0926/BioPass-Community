import { Suspense } from "react";
import { AppstoreOutlined, SafetyOutlined, SecurityScanOutlined } from "@ant-design/icons";
import { Navigate, Outlet } from "react-router";

import { SvgIcon } from "@/components/icon";
import { CircleLoading } from "@/components/loading";

import type { AppRouteObject } from "#/router";
import { PermissionAccount } from "@/types/enum";
import { safeLazyImport } from "../../utils/lazy-import";

const Script = safeLazyImport(() => import("@/pages/dashboard/script"));
const Application = safeLazyImport(() => import("@/pages/application"));
const ApplicationDetail = safeLazyImport(() => import("@/pages/application/detail"));
const ApplicationCreate = safeLazyImport(() => import("@/pages/application/create"));
const AuthLog = safeLazyImport(() => import("@/pages/auth-log"));
const AuthLogDetail = safeLazyImport(() => import("@/pages/auth-log/detail"));
const PolicySecurity = safeLazyImport(() => import("@/pages/policy-security"));

const service: AppRouteObject = {
	order: 1,
	path: "service",
	element: (
		<Suspense fallback={<CircleLoading />}>
			<Outlet />
		</Suspense>
	),
	meta: {
		label: "sys.menu.service",
		icon: (
			<SvgIcon icon="ic-analysis" className="ant-menu-item-icon" size="24" />
		),
		key: "/service",
		permissions: [PermissionAccount.SUPER_ADMIN, PermissionAccount.ADMIN, PermissionAccount.USER],
		hideMenu: true, // 그룹은 메뉴에 표시하지 않고 children만 표시
		section: "service", // 섹션 이름
	},
	children: [
		{
			index: true,
			element: <Navigate to="/service/dashboard" replace />,
			meta: { key: "/service/index", label: "", hideMenu: true },
		},
		{
			path: "dashboard",
			element: <Script />,
			meta: {
				label: "sys.menu.dashboard",
				icon: (
					<SvgIcon icon="ic-analysis" className="ant-menu-item-icon" size="24" />
				),
				key: "/service/dashboard",
				permissions: [PermissionAccount.SUPER_ADMIN, PermissionAccount.ADMIN],
				hideMenu: false,
				section: "service",
			},
		},
		{
			path: "application",
			element: <Application />,
			meta: {
				label: "sys.menu.application.title",
				icon: (
					<AppstoreOutlined className="ant-menu-item-icon" style={{ fontSize: "24px" }} />
				),
				key: "/service/application",
				permissions: [PermissionAccount.SUPER_ADMIN, PermissionAccount.ADMIN, PermissionAccount.USER],
				hideMenu: false,
				section: "service",
			},
		},
		{
			path: "application/:id",
			element: <ApplicationDetail />,
			meta: {
				label: "sys.menu.application.detail",
				hideMenu: true,
				key: "/service/application/:id"
			},
		},
		{
			path: "application/create",
			element: <ApplicationCreate />,
			meta: {
				label: "sys.menu.application.create",
				hideMenu: true,
				key: "/service/application/create"
			},
		},
		{
			path: "auth-log",
			element: <AuthLog />,
			meta: {
				label: "sys.menu.authLog",
				icon: (
					<SafetyOutlined className="ant-menu-item-icon" style={{ fontSize: "24px" }} />
				),
				key: "/service/auth-log",
				permissions: [PermissionAccount.SUPER_ADMIN, PermissionAccount.ADMIN],
				hideMenu: false,
				section: "service",
			},
		},
		{
			path: "auth-log/:id",
			element: <AuthLogDetail />,
			meta: {
				label: "sys.menu.authLog.detail",
				hideMenu: true,
				key: "/service/auth-log/:id"
			},
		},
		{
			path: "security-policy",
			element: <PolicySecurity />,
			meta: {
				label: "sys.menu.policySecurity",
				icon: (
					<SecurityScanOutlined className="ant-menu-item-icon" style={{ fontSize: "24px" }} />
				),
				key: "/service/security-policy",
				permissions: [PermissionAccount.SUPER_ADMIN, PermissionAccount.ADMIN],
				hideMenu: false,
				section: "service",
			},
		},
	],
};

export default service;
