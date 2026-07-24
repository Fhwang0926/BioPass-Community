import { Tabs, type TabsProps } from "antd";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { Iconify } from "@/components/icon";
import { t } from "@/locales/i18n";

import GeneralTab from "./general-tab";
import NotificationsTab from "./notifications-tab";
import SecurityTab from "./security-tab";
import CompanyTab from "./company-tab";

function UserAccount() {
	const [searchParams, setSearchParams] = useSearchParams();
	const initialKey = searchParams.get("tab") || "1";
	const [activeKey, setActiveKey] = useState(initialKey);

	useEffect(() => {
		const tab = searchParams.get("tab");
		if (tab && tab !== activeKey) {
			setActiveKey(tab);
		} else if (!tab && activeKey !== "1") {
			setActiveKey("1");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams]);

	const handleTabChange = (key: string) => {
		setActiveKey(key);
		setSearchParams((prev) => {
			const params = new URLSearchParams(prev);
			if (key === "1") {
				params.delete("tab");
			} else {
				params.set("tab", key);
			}
			return params;
		});
	};

	const items: TabsProps["items"] = [
		{
			key: "1",
			label: (
				<div className="flex items-center">
					<Iconify icon="solar:user-id-bold" size={24} className="mr-2" />
					<span>{t('sys.menu.account.general.title')}</span>
				</div>
			),
			children: <GeneralTab />,
		},
		{
			key: "2",
			label: (
				<div className="flex items-center">
					<Iconify
						icon="solar:key-minimalistic-square-3-bold-duotone"
						size={24}
						className="mr-2"
					/>
					<span>{t('sys.menu.account.company.title')}</span>
				</div>
			),
			children: <CompanyTab />,
		},
		{
			key: "3",
			label: (
				<div className="flex items-center">
					<Iconify
						icon="solar:bell-bing-bold-duotone"
						size={24}
						className="mr-2"
					/>
					<span>{t('sys.menu.account.notifications.timeline_title')}</span>
				</div>
			),
			children: <NotificationsTab />,
		},
		{
			key: "4",
			label: (
				<div className="flex items-center">
					<Iconify
						icon="solar:key-minimalistic-square-3-bold-duotone"
						size={24}
						className="mr-2"
					/>
					<span>{t('sys.menu.account.security.change_password')}</span>
				</div>
			),
			children: <SecurityTab />,
		},
		
	];

	return <Tabs activeKey={activeKey} onChange={handleTabChange} items={items} />;
}

export default UserAccount;
