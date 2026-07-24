import { useMemo } from "react";
import { Navigate, useLocation } from "react-router";

import { useUserPermission } from "@/store/userStore";
import type { AppRouteObject } from "#/router";
import { checkShowPermission } from "../utils";
import { usePermissionRoutes } from "../hooks/use-permission-routes";

function collectRouteMetas(routes: AppRouteObject[], acc: AppRouteObject["meta"][] = []) {
	for (const route of routes) {
		if (route.meta?.key) acc.push(route.meta);
		if (route.children?.length) collectRouteMetas(route.children, acc);
	}
	return acc;
}

/** 현재 경로에 대한 메뉴 권한 검사 — 사이드바 숨김만으로는 URL 직접 접근을 막을 수 없음 */
export default function PermissionGuard({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const userPermission = useUserPermission() ?? "";
	const permissionRoutes = usePermissionRoutes();

	const matchedMeta = useMemo(() => {
		const metas = collectRouteMetas(permissionRoutes);
		const pathname = location.pathname;

		// 정확한 key 매칭 우선
		const exact = metas.find((m) => m?.key === pathname);
		if (exact) return exact;

		// 동적 세그먼트(:id 등) — 가장 긴 prefix 매칭
		const prefixMatches = metas
			.filter((m) => m?.key && pathname.startsWith(`${m.key}/`))
			.sort((a, b) => (b?.key?.length ?? 0) - (a?.key?.length ?? 0));
		return prefixMatches[0] ?? null;
	}, [location.pathname, permissionRoutes]);

	if (matchedMeta?.permissions?.length && !checkShowPermission({ meta: matchedMeta } as AppRouteObject, userPermission)) {
		return <Navigate to="/403" replace />;
	}

	return <>{children}</>;
}
