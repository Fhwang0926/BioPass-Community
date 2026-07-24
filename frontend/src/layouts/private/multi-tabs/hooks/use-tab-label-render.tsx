import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { KeepAliveTab } from "../types";

export function useTabLabelRender() {
	const { t } = useTranslation();

	const specialTabRenderMap = useMemo<
		Record<string, (tab: KeepAliveTab) => React.ReactNode>
	>(
		() => ({
			"sys.menu.system.user_detail": (tab: KeepAliveTab) => {
				// const userId = tab.params?.id;
				const defaultLabel = t(tab.label);
				// if (userId) {
				// 	const user = USER_LIST.find((item) => item.id === userId);
				// 	return `${user?.name}-${defaultLabel}`;
				// }
				return defaultLabel;
			},
		}),
		[t],
	);

	const renderTabLabel = (tab: KeepAliveTab) => {
		const specialRender = specialTabRenderMap[tab.label];
		if (specialRender) {
			return specialRender(tab);
		}
		const labelText = t(tab.label);
		return typeof labelText === 'string' ? labelText : String(labelText);
	};

	return renderTabLabel;
}
