import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { Iconify, SvgIcon } from "@/components/icon";

import { useSettings } from "@/store/settingStore";
import { cn } from "@/utils";
import type { GetProp, MenuProps } from "antd";
import { Tag } from "antd";
import { ThemeLayout } from "#/enum";
import type { AppRouteObject } from "#/router";
import { checkShowPermission } from "../utils";
import { useUserPermission } from "@/store/userStore";
type MenuItem = GetProp<MenuProps, "items">[number];

const renderIcon = (icon: string | React.ReactNode): React.ReactNode => {
	if (typeof icon !== "string") return icon;

	return icon.startsWith("ic") ? (
		<SvgIcon icon={icon} size={24} className="ant-menu-item-icon" />
	) : (
		<Iconify icon={icon} size={24} className="ant-menu-item-icon" />
	);
};

/**
 * 라우트를 계층 구조로 변환 (children 유지)
 */
function buildMenuHierarchy(items: AppRouteObject[], userPermission: string, parentSection?: string): Array<AppRouteObject & { section?: string }> {
	const result: Array<AppRouteObject & { section?: string }> = [];
	
	for (const item of items) {
		if (!item.meta?.hideMenu && checkShowPermission(item, userPermission)) {
			const section = item.meta?.section || parentSection;
			const menuItem: AppRouteObject & { section?: string } = {
				...item,
				section,
			};
			
			// children이 있으면 재귀적으로 처리
			if (item.children && item.children.length > 0) {
				const filteredChildren = item.children.filter(
					(child) => !child.meta?.hideMenu && checkShowPermission(child, userPermission)
				);
				
				if (filteredChildren.length > 0) {
					menuItem.children = buildMenuHierarchy(filteredChildren, userPermission, section);
					result.push(menuItem);
				} else if (!item.meta?.hideMenu) {
					// children이 없지만 메뉴에 표시해야 하는 경우
					result.push(menuItem);
				}
			} else {
				// 최종 메뉴 아이템
				result.push(menuItem);
			}
		} else if (item.children) {
			// hideMenu이지만 children이 있으면 children 탐색
			const section = item.meta?.section || parentSection;
			const childItems = buildMenuHierarchy(item.children, userPermission, section);
			result.push(...childItems);
		}
	}
	
	return result;
}

/**
 *   routes -> menus (섹션별로 그룹화)
 */
export function useRouteToMenuFn() {
	const { t } = useTranslation();
	const { themeLayout } = useSettings();
	const userPermission = useUserPermission();

	/**
	 * 라우트를 메뉴 아이템으로 변환 (재귀적으로 children 처리)
	 */
	const convertToMenuItem = useCallback((item: AppRouteObject & { section?: string }, sectionKey: string): MenuItem | null => {
		const { meta, children } = item;
		if (!meta) return null;

		const adminBadge = meta.key === "/management/users" ? (
			<Tag 
				color="red" 
				style={{ 
					marginLeft: "8px", 
					fontSize: "10px", 
					padding: "0 4px",
					lineHeight: "16px",
					height: "16px"
				}}
			>
				ADMIN
			</Tag>
		) : null;

		// children이 있으면 재귀적으로 변환
		const childMenuItems: MenuItem[] = children
			? children
					.map((child) => convertToMenuItem(child as AppRouteObject & { section?: string }, sectionKey))
					.filter((item): item is MenuItem => item !== null)
			: [];

		const menuItem: Partial<MenuItem> = {
			key: meta.key,
			disabled: meta.disabled,
			label: (
				<div
					className={cn(
						"inline-flex items-center overflow-hidden",
						themeLayout === ThemeLayout.Horizontal
							? "justify-start"
							: "justify-between",
					)}
				>
					<div className="">{t(meta.label)}</div>
					<div className="flex items-center gap-1">
						{adminBadge}
						{meta.suffix}
					</div>
				</div>
			),
			...(meta.icon && { icon: renderIcon(meta.icon) }),
			...(childMenuItems.length > 0 && { children: childMenuItems }),
		};

		return menuItem as MenuItem;
	}, [t, themeLayout]);

	const routeToMenuFn = useCallback(
		(items: AppRouteObject[]): MenuItem[] => {
			// 계층 구조로 변환 (children 유지)
			const hierarchicalItems = buildMenuHierarchy(items, userPermission ?? "");
			
			// 섹션별로 그룹화
			const sectionMap = new Map<string, Array<AppRouteObject & { section?: string }>>();
			
			hierarchicalItems.forEach((item) => {
				const section = item.section || "default";
				if (!sectionMap.has(section)) {
					sectionMap.set(section, []);
				}
				sectionMap.get(section)!.push(item);
			});
			
			// 섹션 순서 정의 (userManagement는 service에 포함됨, myInfo는 서비스 다음)
			const sectionOrder = ["service", "myInfo", "developer", "security", "support", "system"];
			const menuItems: MenuItem[] = [];
			
			// 섹션별로 Menu.ItemGroup 생성
			sectionOrder.forEach((sectionKey, index) => {
				const sectionItems = sectionMap.get(sectionKey);
				if (sectionItems && sectionItems.length > 0) {
					// 섹션 구분선 추가 (첫 번째 섹션이 아니면)
					if (index > 0) {
						menuItems.push({ type: "divider" } as MenuItem);
					}
					
					// 섹션 아이템들을 메뉴 아이템으로 변환
					const groupItems: MenuItem[] = sectionItems
						.map((item) => convertToMenuItem(item, sectionKey))
						.filter((item): item is MenuItem => item !== null);
					
					const sectionLabel = (
						<span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
							{t(sectionKey === "system" ? `sys.menu.${sectionKey}.index` : `sys.menu.${sectionKey}`)}
						</span>
					);
					
					menuItems.push({
						type: "group",
						label: sectionLabel,
						children: groupItems,
					} as MenuItem);
				}
			});
			
			// 기본 섹션 (section이 없는 아이템들)
			const defaultItems = sectionMap.get("default");
			if (defaultItems && defaultItems.length > 0) {
				if (menuItems.length > 0) {
					menuItems.push({ type: "divider" } as MenuItem);
				}
				const groupItems: MenuItem[] = defaultItems
					.map((item) => convertToMenuItem(item, "default"))
					.filter((item): item is MenuItem => item !== null);
				menuItems.push(...groupItems);
			}
			
			return menuItems;
		},
		[t, themeLayout, userPermission, convertToMenuItem],
	);
	return routeToMenuFn;
}
