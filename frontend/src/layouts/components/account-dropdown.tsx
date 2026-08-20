import { Divider, type MenuProps } from "antd";
import Dropdown, { type DropdownProps } from "antd/es/dropdown/dropdown";
import React from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { useRouter } from "@/router/hooks";
import { useUserActions, useUserInfo } from "@/store/userStore";
import { useTheme } from "@/theme/hooks";
import logo from "@/assets/images/logo.png";
import { getHomePageNavigatePath } from "@/router/utils";

/**
 * Account Dropdown
 */
export default function AccountDropdown() {
	const { replace } = useRouter();
	const { email, name } = useUserInfo();
	const { clearUserInfoAndToken } = useUserActions();
	const { t } = useTranslation();

	const logout = () => {
		try {
			clearUserInfoAndToken();
		} catch (error) {
			console.log(error);
		} finally {
			replace("/login");
		}
	};

	const {
		themeVars: { colors, borderRadius, shadows },
	} = useTheme();

	const contentStyle: React.CSSProperties = {
		backgroundColor: colors.background.default,
		borderRadius: borderRadius.lg,
		boxShadow: shadows.dropdown,
	};

	const menuStyle: React.CSSProperties = {
		boxShadow: "none",
	};

	const dropdownRender: DropdownProps["dropdownRender"] = (menu) => (
		<div style={contentStyle}>
			<div className="flex flex-col items-start p-4">
				<div className="max-w-56 break-all">{name}</div>
				<div className="max-w-56 break-all text-gray">{email}</div>
			</div>
			<Divider style={{ margin: 0 }} />
			{React.cloneElement(menu as React.ReactElement<{ style?: React.CSSProperties }>, { style: menuStyle })}
		</div>
	);

	const items: MenuProps["items"] = [
		{
			label: <NavLink to={getHomePageNavigatePath()}>{t("sys.menu.dashboard")}</NavLink>,
			key: "1",
		},
		{
			label: <NavLink to="/management/account">{t("sys.menu.user.account")}</NavLink>,
			key: "2",
		},
		{ type: "divider" },
		{
			label: (
				<button className="font-bold text-warning" type="button">
					{t("sys.login.logout")}
				</button>
			),
			key: "5",
			onClick: logout,
		},
	];

	return (
		<Dropdown
			menu={{ items }}
			trigger={["click"]}
			dropdownRender={dropdownRender}
			getPopupContainer={() => document.body}
		>
			<button
				type="button"
				className="flex h-10 w-10 transform-none cursor-pointer items-center justify-center rounded-full p-2 px-0 hover:bg-gray-500/10 hover:scale-105"
				aria-label="Account menu"
			>
				<img
					style={{ color: "white" }}
					className="h-8 w-8 rounded-full object-cover border border-gray-100"
					src={logo}
					alt=""
				/>
			</button>
		</Dropdown>
	);
}
