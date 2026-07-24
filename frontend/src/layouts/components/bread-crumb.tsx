import { Breadcrumb, type BreadcrumbProps, type GetProp } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useMatches } from "react-router";

import { Iconify } from "@/components/icon";
import { useFlattenedRoutes, usePermissionRoutes } from "@/router/hooks";
import { menuFilter } from "@/router/utils";

type MenuItem = GetProp<BreadcrumbProps, "items">[number];

export default function BreadCrumb() {
	const { t } = useTranslation();
	const matches = useMatches();
	const flattenedRoutes = useFlattenedRoutes();
	const permissionRoutes = usePermissionRoutes();

	const breadCrumbs = useMemo(() => {
		const menuRoutes = menuFilter(permissionRoutes);
		const paths = matches.filter((item) => item.pathname !== "/").map((item) => item.pathname);

		const pathRouteMetas = flattenedRoutes.filter((item) => paths.includes(item.key));
		// 동일 key 중복 제거 (같은 key가 여러 라우트에 있으면 첫 번째만 사용)
		const seen = new Set<string>();
		const uniquePathRouteMetas = pathRouteMetas.filter((item) => {
			if (seen.has(item.key)) return false;
			seen.add(item.key);
			return true;
		});

		let currentMenuItems = [...menuRoutes];

		return uniquePathRouteMetas.map((routeMeta): MenuItem => {
			const { key, label } = routeMeta;

			// Find current level menu items
			const currentRoute = currentMenuItems.find((item) => item.meta?.key === key);

			// Update menu items for next level
			currentMenuItems = currentRoute?.children?.filter((item) => !item.meta?.hideMenu) ?? [];

			return {
				key,
				title: t(label),
				...(currentMenuItems.length > 0 && {
					menu: {
						items: currentMenuItems.map((item) => ({
							key: item.meta?.key,
							label: item.meta?.key ? <Link to={item.meta.key}>{t(item.meta.label)}</Link> : null,
						})),
					},
				}),
			};
		});
	}, [matches, flattenedRoutes, t, permissionRoutes]);

	return <Breadcrumb items={breadCrumbs} className="!text-sm" separator={<Iconify icon="ph:dot-duotone" />} />;
}
