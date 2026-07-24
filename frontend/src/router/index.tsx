import DashboardLayout from "@/layouts/private";
import { PrivacyPolicyPage, TermsOfServicePage } from "@/pages/legal";
import PageError from "@/pages/system/error/PageError";
import Login from "@/pages/system/login/Login";
import SetupPage from "@/pages/system/setup";
import Welcome from "@/pages/welcome";
import ProtectedRoute from "@/router/components/protected-route";
import { usePermissionRoutes } from "@/router/hooks";
import { ERROR_ROUTE } from "@/router/routes/error-routes";
import { ErrorBoundary } from "react-error-boundary";
import { Navigate, type RouteObject, createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { AppRouteObject } from "#/router";

const { VITE_APP_HOMEPAGE: HOMEPAGE } = import.meta.env;

const WELCOME_ROUTE: AppRouteObject = {
	path: "/welcome",
	element: (
		<ErrorBoundary FallbackComponent={PageError}>
			<Welcome />
		</ErrorBoundary>
	),
};

const SETUP_ROUTE: AppRouteObject = {
	path: "/setup",
	element: (
		<ErrorBoundary FallbackComponent={PageError}>
			<SetupPage />
		</ErrorBoundary>
	),
};

const LOGIN_ROUTE: AppRouteObject = {
	path: "/login",
	element: (
		<ErrorBoundary FallbackComponent={PageError}>
			<Login />
		</ErrorBoundary>
	),
};

const PRIVACY_ROUTE: AppRouteObject = {
	path: "/privacy",
	element: (
		<ErrorBoundary FallbackComponent={PageError}>
			<PrivacyPolicyPage />
		</ErrorBoundary>
	),
};

const TERMS_ROUTE: AppRouteObject = {
	path: "/terms",
	element: (
		<ErrorBoundary FallbackComponent={PageError}>
			<TermsOfServicePage />
		</ErrorBoundary>
	),
};

/** 해시가 비어 있을 때(path "") 루트(/)로 리다이렉트 → 이후 index가 service/dashboard 등으로 보냄 */
const EMPTY_HASH_ROUTE: AppRouteObject = {
	path: "",
	element: <Navigate to="/" replace />,
};

const NO_MATCHED_ROUTE: AppRouteObject = {
	path: "*",
	element: <Navigate to="/404" replace />,
};

export default function Router() {
	const permissionRoutes = usePermissionRoutes();

	// HOMEPAGE가 절대 경로인 경우 상대 경로로 변환 (index에서 Navigate to에 사용)
	const getHomePagePath = () => {
		if (!HOMEPAGE) return "service/dashboard";
		if (HOMEPAGE.startsWith("/")) {
			const path = HOMEPAGE.substring(1);
			if (path === "dashboard" || path === "service/dashboard" || path === "") return "service/dashboard";
			return path;
		}
		return HOMEPAGE;
	};

	const homePath = getHomePagePath();
	const PROTECTED_ROUTE: AppRouteObject = {
		path: "/",
		element: (
			<ProtectedRoute>
				<DashboardLayout />
			</ProtectedRoute>
		),
		children: [
			{ index: true, element: <Navigate to={homePath} replace /> },
			...(permissionRoutes ?? []),
			// 보호 구역 내 미매칭 경로는 홈으로 (전역 * 로 빠져 404 되지 않도록)
			{ path: "*", element: <Navigate to={homePath} replace /> },
		],
	};

	// 에러(403/404/500)를 PROTECTED보다 앞에 두어 /404 등이 보호 구역 *에 걸리지 않도록
	const routes = [EMPTY_HASH_ROUTE, WELCOME_ROUTE, SETUP_ROUTE, LOGIN_ROUTE, PRIVACY_ROUTE, TERMS_ROUTE, ERROR_ROUTE, PROTECTED_ROUTE, NO_MATCHED_ROUTE] as RouteObject[];

	const router = createHashRouter(routes);

	return <RouterProvider router={router} />;
}
