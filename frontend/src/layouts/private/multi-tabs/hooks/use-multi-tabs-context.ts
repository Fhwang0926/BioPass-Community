import { useContext } from "react";
import { MultiTabsContext } from "../providers/multi-tabs-context";

export function useMultiTabsContext() {
	return useContext(MultiTabsContext);
}
