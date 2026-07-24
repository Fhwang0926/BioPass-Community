import { useCurrentRouteMeta } from "@/router/hooks";
import { replaceDynamicParams } from "@/router/hooks/use-current-route-meta";
import { isEmpty } from "ramda";
import { useEffect, useMemo, useState } from "react";
import { useTabOperations } from "../hooks/use-tab-operations";
import type { KeepAliveTab } from "../types";
import { MultiTabsContext } from "./multi-tabs-context";

export function MultiTabsProvider({ children }: { children: React.ReactNode }) {
	const [tabs, setTabs] = useState<KeepAliveTab[]>([]);
	const currentRouteMeta = useCurrentRouteMeta();

	const activeTabRoutePath = useMemo(() => {
		if (!currentRouteMeta) return "";
		const { key, params = {} } = currentRouteMeta;
		return isEmpty(params) ? key : replaceDynamicParams(key, params);
	}, [currentRouteMeta]);

	const operations = useTabOperations(tabs, setTabs, activeTabRoutePath);

	useEffect(() => {
		if (!currentRouteMeta) return;

		setTabs((prev) => {
			const filtered = prev.filter((item) => !item.hideTab);

			let { key } = currentRouteMeta;
			const { outlet: children, params = {} } = currentRouteMeta;

			if (!isEmpty(params)) {
				key = replaceDynamicParams(key, params);
			}

			const isExisted = filtered.find((item) => item.key === key);
			if (!isExisted) {
				return [
					...filtered,
					{
						...currentRouteMeta,
						key,
						children,
						timeStamp: new Date().getTime().toString(),
					},
				];
			}

			return filtered;
		});
	}, [currentRouteMeta]);

	const contextValue = useMemo(
		() => ({
			tabs,
			activeTabRoutePath,
			setTabs,
			...operations,
		}),
		[tabs, activeTabRoutePath, operations],
	);

	return <MultiTabsContext.Provider value={contextValue}>{children}</MultiTabsContext.Provider>;
}
