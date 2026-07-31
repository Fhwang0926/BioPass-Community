import { Suspense } from "react";
import { Outlet, Navigate } from "react-router";

import { SvgIcon } from "@/components/icon";
import { CircleLoading } from "@/components/loading";

import type { AppRouteObject } from "#/router";
import { PermissionAccount } from "@/types/enum";
import { safeLazyImport } from "../../utils/lazy-import";

const LogMail = safeLazyImport(() => import("@/pages/log/mail"));
const LogAudit = safeLazyImport(() => import("@/pages/log/audit"));
const LogAlarm = safeLazyImport(() => import("@/pages/log/alarm"));

const system: AppRouteObject = {
	order: 5,
	path: "system",
	element: (
		<Suspense fallback={<CircleLoading />}>
			<Outlet />
		</Suspense>
	),
	meta: {
		label: "sys.menu.system.index",
		icon: (
			<SvgIcon icon="ic-log" className="ant-menu-item-icon" size="24" />
		),
		key: "/system",
		permissions: [PermissionAccount.ADMIN],
		hideMenu: true,
		section: "system",
	},
	children: [
		{
			index: true,
			element: <Navigate to="log" replace />,
			meta: { key: "/system", label: "", hideMenu: true },
		},
		{
			path: "log",
			element: (
				<Suspense fallback={<CircleLoading />}>
					<Outlet />
				</Suspense>
			),
			meta: {
				label: "sys.menu.systemLog",
				key: "/system/log",
				permissions: [PermissionAccount.ADMIN],
				hideMenu: false,
				section: "system",
			},
			children: [
				{
					index: true,
					element: <Navigate to="mail" replace />,
					meta: { key: "/system/log", label: "", hideMenu: true },
				},
				{
					path: "mail",
					element: <LogMail />,
					meta: {
						label: "sys.menu.log.mail",
						key: "/system/log/mail",
						permissions: [PermissionAccount.ADMIN],
						hideMenu: false,
						section: "system",
					},
				},
				{
					path: "audit",
					element: <LogAudit />,
					meta: {
						label: "sys.menu.log.audit",
						key: "/system/log/audit",
						permissions: [PermissionAccount.ADMIN],
						hideMenu: false,
						section: "system",
					},
				},
				{
					path: "alarm",
					element: <LogAlarm />,
					meta: {
						label: "sys.menu.log.alarm",
						key: "/system/log/alarm",
						permissions: [PermissionAccount.ADMIN],
						hideMenu: false,
						section: "system",
					},
				},
			],
		},
	],
};

export default system;
