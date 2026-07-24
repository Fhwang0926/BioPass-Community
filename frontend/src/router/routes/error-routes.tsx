import { Suspense } from "react";
import { Outlet } from "react-router";

import { CircleLoading } from "@/components/loading";
import SimpleLayout from "@/layouts/simple";

import ProtectedRoute from "../components/protected-route";
import { safeLazyImport } from "../utils/lazy-import";

import type { AppRouteObject } from "#/router";

const Page403 = safeLazyImport(() => import("@/pages/system/error/Page403"));
const Page404 = safeLazyImport(() => import("@/pages/system/error/Page404"));
const Page500 = safeLazyImport(() => import("@/pages/system/error/Page500"));

/**
 * error routes
 * 403, 404, 500
 */
export const ERROR_ROUTE: AppRouteObject = {
	element: (
		<ProtectedRoute>
			<SimpleLayout>
				<Suspense fallback={<CircleLoading />}>
					<Outlet />
				</Suspense>
			</SimpleLayout>
		</ProtectedRoute>
	),
	children: [
		{ path: "403", element: <Page403 /> },
		{ path: "404", element: <Page404 /> },
		{ path: "500", element: <Page500 /> },
	],
};
