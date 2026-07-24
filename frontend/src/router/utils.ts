import { ascend } from "ramda";

import type { AppRouteObject, RouteMeta } from "#/router";

/**
 * VITE_APP_HOMEPAGE 환경 변수에 따라 대시보드(홈) 이동 경로 반환.
 * 라우터 index의 getHomePagePath와 동일 규칙 (Login, ProtectedRoute, 로그인 성공 후 이동에 사용).
 */
export function getHomePageNavigatePath(): string {
	const HOMEPAGE = import.meta.env.VITE_APP_HOMEPAGE;
	if (!HOMEPAGE) return "/service/dashboard";
	if (HOMEPAGE.startsWith("/")) {
		const path = HOMEPAGE.substring(1);
		if (path === "dashboard" || path === "service/dashboard" || path === "") return "/service/dashboard";
		return "/" + path;
	}
	return "/" + HOMEPAGE;
}
import { PermissionAccount } from "@/types/enum";

/**
 * return menu routes
 */
export const menuFilter = (items: AppRouteObject[]) => {
	return items
		.filter((item) => {
			const show = item.meta?.key;
			if (show && item.children) {
				item.children = menuFilter(item.children);
			}
			return show;
		})
		.sort(ascend((item) => item.order || Number.POSITIVE_INFINITY));
};

/**
 * 基于 src/router/routes/modules 文件结构动态生成路由
 */
export function getRoutesFromModules() {
	const menuModules: AppRouteObject[] = [];
	const modules = import.meta.glob("./routes/modules/**/*.tsx", {
		eager: true,
	});
	for (const key in modules) {
		const mod = (modules as any)[key].default || {};
		const modList = Array.isArray(mod) ? [...mod] : [mod];
		// Filter routes based on permissions
		const filteredModList = modList.map(route => {
			
			if (!route.children) return route;

			route.children = filterByPermission(route.children);
			return route;
		});

		modList.length = 0;
		modList.push(...filteredModList);
		menuModules.push(...modList);
	}
	return menuModules;
}

/**
 * return the routes will be used in sidebar menu
 */
const filterByPermission = (routes: AppRouteObject[]): AppRouteObject[] => {
	return routes.map(route => {
		if (!route.meta?.permissions || !route.children) return route;
		
		route.children = filterByPermission(route.children);

		return route;
	});
};

export function checkShowPermission(route: AppRouteObject, permissions: string) {
	// permissions가 없으면 권한 체크 없이 통과
	if (!route?.meta?.permissions || route.meta.permissions.length === 0) {
		return true;
	}
	
	const upperPermissions = permissions?.toUpperCase();
	
	return (
		(route.meta.permissions.includes(PermissionAccount.SUPER_ADMIN) && upperPermissions == "SUPER_ADMIN") ||
		(route.meta.permissions.includes(PermissionAccount.ADMIN) && upperPermissions == "ADMIN") ||
		(route.meta.permissions.includes(PermissionAccount.USER) && upperPermissions == "USER") ||
		(route.meta.permissions.includes(PermissionAccount.APP) && upperPermissions == "APP")
	)
}

/**
 * return the routes will be used in sidebar menu
 */
export function getMenuRoutes(appRouteObjects: AppRouteObject[]) {
	// return menuFilter(getMenuModules());
	return menuFilter(appRouteObjects);
}

/**
 * return flatten routes
 */
export function flattenMenuRoutes(routes: AppRouteObject[]) {
	return routes.reduce<RouteMeta[]>((prev, item) => {
		const { meta, children } = item;
		if (meta) prev.push(meta);
		if (children) prev.push(...flattenMenuRoutes(children));
		return prev;
	}, []);
}
