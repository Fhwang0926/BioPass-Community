import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Application } from "@/api/services/application";
import {
	deriveBackendLoginUrl,
	getApiBase,
	loginIdentifierToScope,
	normalizeApplicationFields,
} from "@/utils/bioPassApi";

export interface IntegrationVars {
	apiBase: string;
	clientId: string;
	/** Bio-Pass 앱에 등록한 Callback URL (백엔드 콜백 엔드포인트) */
	redirectUri: string;
	/** 프론트 로그인 버튼이 이동할 자체 백엔드 URL */
	backendLoginUrl: string;
	scope: string;
	hasApp: boolean;
	application: Application | null;
}

const PLACEHOLDER: IntegrationVars = {
	apiBase: getApiBase(),
	clientId: "YOUR_CLIENT_ID",
	redirectUri: "https://your-site.com/api/auth/callback",
	backendLoginUrl: "https://your-site.com/api/auth/login",
	scope: "email",
	hasApp: false,
	application: null,
};

const IntegrationContext = createContext<IntegrationVars>(PLACEHOLDER);

export function IntegrationProvider({
	application,
	children,
}: {
	application: Application | null;
	children: ReactNode;
}) {
	const value = useMemo((): IntegrationVars => {
		if (!application) {
			return { ...PLACEHOLDER, apiBase: getApiBase() };
		}
		const fields = normalizeApplicationFields(application);
		const redirectUri = fields.callbackUrl || PLACEHOLDER.redirectUri;
		return {
			apiBase: getApiBase(),
			clientId: fields.clientId,
			redirectUri,
			backendLoginUrl: deriveBackendLoginUrl(redirectUri),
			scope: loginIdentifierToScope(fields.loginIdentifier),
			hasApp: Boolean(fields.clientId && fields.callbackUrl),
			application,
		};
	}, [application]);

	return (
		<IntegrationContext.Provider value={value}>{children}</IntegrationContext.Provider>
	);
}

export function useIntegrationVars() {
	return useContext(IntegrationContext);
}
