import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation } from "react-router";

import authService from "@/api/services/auth";
import userStore, { useUserToken } from "@/store/userStore";

import PageError from "@/pages/system/error/PageError";
import { useRouter } from "../hooks";

type Props = {
	children: React.ReactNode;
};

async function resolveAuthRedirectPath(): Promise<"/setup" | "/login"> {
	try {
		if (await authService.getNeedsSetup()) return "/setup";
	} catch {
		// fall through to login
	}
	return "/login";
}

export default function ProtectedRoute({ children }: Props) {
	const router = useRouter();
	const location = useLocation();
	const token = useUserToken();
	const accessToken = token?.accessToken;
	const [gateChecked, setGateChecked] = useState(Boolean(accessToken));

	useEffect(() => {
		if (accessToken) {
			setGateChecked(true);
			return;
		}
		const id = setTimeout(async () => {
			if (userStore.getState().userToken?.accessToken) {
				setGateChecked(true);
				return;
			}
			const path = await resolveAuthRedirectPath();
			router.replace(path);
			setGateChecked(true);
		}, 50);
		return () => clearTimeout(id);
	}, [accessToken, location.pathname, router]);

	if (!accessToken) {
		if (!gateChecked) return null;
		return null;
	}

	return <ErrorBoundary FallbackComponent={PageError}>{children}</ErrorBoundary>;
}
