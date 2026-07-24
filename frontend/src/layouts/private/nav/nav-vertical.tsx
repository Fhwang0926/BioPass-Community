import { Layout, Menu, type MenuProps } from "antd";
import { useMemo, useState, useEffect } from "react";
import { useMatches, useNavigate } from "react-router";

import Scrollbar from "@/components/scrollbar";
import { useFlattenedRoutes, usePathname, usePermissionRoutes, useRouteToMenuFn } from "@/router/hooks";
import { menuFilter } from "@/router/utils";
import { useSettingActions, useSettings } from "@/store/settingStore";

import { NAV_WIDTH } from "../config";

import NavLogo from "./nav-logo";

import { ThemeLayout, ThemeMode } from "#/enum";

const { Sider } = Layout;

type Props = {
	closeSideBarDrawer?: () => void;
};
export default function NavVertical(props: Props) {
	const navigate = useNavigate();
	const matches = useMatches();
	const pathname = usePathname();

	const settings = useSettings();
	const { themeLayout, themeMode, darkSidebar } = settings;
	const { setSettings } = useSettingActions();

	const routeToMenuFn = useRouteToMenuFn();
	const permissionRoutes = usePermissionRoutes();
	const flattenedRoutes = useFlattenedRoutes();

	const collapsed = useMemo(() => themeLayout === ThemeLayout.Mini, [themeLayout]);

	const menuList = useMemo(() => {
		const menuRoutes = menuFilter(permissionRoutes);
		return routeToMenuFn(menuRoutes);
	}, [routeToMenuFn, permissionRoutes]);

	// pathname이 변경될 때 selectedKeys 업데이트
	const getSelectedKey = useMemo(() => {
		// 메뉴에 있는 key 중에서 현재 pathname과 매칭되는 것을 찾음
		const menuKeys = flattenedRoutes?.map((route) => route.key).filter(Boolean) || [];
		
		// 정확히 일치하는 경우
		if (menuKeys.includes(pathname)) {
			return pathname;
		}
		
		// pathname이 메뉴 key로 시작하는 경우 (중첩 라우트)
		const matchedKey = menuKeys.find((key) => pathname.startsWith(key + '/') || pathname === key);
		if (matchedKey) {
			return matchedKey;
		}
		
		// 매칭되는 것이 없으면 pathname 그대로 사용
		return pathname;
	}, [pathname, flattenedRoutes]);

	const [selectedKeys, setSelectedKeys] = useState([getSelectedKey]);
	
	// pathname이 변경될 때 selectedKeys 업데이트
	useEffect(() => {
		setSelectedKeys([getSelectedKey]);
	}, [getSelectedKey]);

	const [openKeys, setOpenKeys] = useState<string[]>(() => {
		if (!collapsed) {
			const keys = matches
				.filter((match) => match.pathname !== "/" && match.pathname !== pathname)
				.map((match) => match.pathname);
			return keys;
		}
		return [];
	});

	const handleToggleCollapsed = () => {
		setSettings({
			...settings,
			themeLayout: collapsed ? ThemeLayout.Vertical : ThemeLayout.Mini,
		});
		if (collapsed) {
			const keys = matches
				.filter((match) => match.pathname !== "/" && match.pathname !== pathname)
				.map((match) => match.pathname);
			setTimeout(() => {
				setOpenKeys(keys);
			}, 0);
			return;
		}
	};

	const onClick: MenuProps["onClick"] = ({ key }) => {
		const nextLink = flattenedRoutes?.find((e) => e.key === key);
		if (nextLink?.hideTab && nextLink?.frameSrc) {
			window.open(nextLink?.frameSrc, "_blank");
			return;
		}

		setSelectedKeys([key]);
		navigate(key);
		props?.closeSideBarDrawer?.();
	};

	const handleOpenChange: MenuProps["onOpenChange"] = (keys) => {
		if (!settings.accordion) {
			setOpenKeys(keys);
			return;
		}

		// 手风琴模式

		const latestOpenKey = keys.find((key) => !openKeys.includes(key));
		// 收起
		if (!latestOpenKey) {
			const closedKey = openKeys.find((key) => !keys.includes(key));
			if (closedKey) {
				// 只移除被收起的菜单，保留其他展开状态
				setOpenKeys(openKeys.filter((key) => key !== closedKey));
			}
			return;
		}
		// 展开
		const getKeyLevel = (key: string) => (key.match(/\//g) || []).length;
		const latestKeyLevel = getKeyLevel(latestOpenKey);
		// 过滤掉同层级的其他 key，保留不同层级的 key
		const newOpenKeys = openKeys.filter((key) => getKeyLevel(key) !== latestKeyLevel);

		// 找到当前打开菜单的所有父级路径
		const parentKeys = matches
			.filter(
				(match) =>
					latestOpenKey.startsWith(match.pathname) && match.pathname !== "/" && match.pathname !== latestOpenKey,
			)
			.map((match) => match.pathname);

		setOpenKeys([...new Set([...parentKeys, ...newOpenKeys, latestOpenKey])]);
	};

	const sidebarTheme = useMemo(() => {
		if (themeMode === ThemeMode.Dark) {
			return darkSidebar ? "light" : "dark";
		}
		return darkSidebar ? "dark" : "light";
	}, [themeMode, darkSidebar]);

	return (
		<Sider
			trigger={null}
			collapsible
			collapsed={collapsed}
			width={NAV_WIDTH}
			theme={sidebarTheme}
			className="!fixed left-0 top-0 h-screen border-r border-dashed border-gray-500/10"
		>
			<div className="flex h-full flex-col">
				<NavLogo collapsed={collapsed} onToggle={handleToggleCollapsed} />

				<Scrollbar>
					<Menu
						mode="inline"
						items={menuList}
						theme={sidebarTheme}
						selectedKeys={selectedKeys}
						openKeys={openKeys}
						onOpenChange={handleOpenChange}
						className="!border-none [&_.ant-menu-item-group-title]:!text-xs [&_.ant-menu-item-group-title]:!font-semibold [&_.ant-menu-item-group-title]:!uppercase [&_.ant-menu-item-group-title]:!tracking-wider [&_.ant-menu-item-group-title]:!text-gray-500 [&_.ant-menu-item-group-title]:dark:!text-gray-400 [&_.ant-menu-item-group-title]:!px-4 [&_.ant-menu-item-group-title]:!py-2 [&_.ant-menu-item-group-title]:!mb-1"
						onClick={onClick}
					/>
				</Scrollbar>
			</div>
		</Sider>
	);
}
