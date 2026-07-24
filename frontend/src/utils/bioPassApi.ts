/** Bio-Pass Web API base URL (절대 경로, trailing slash 없음) */
export function getApiBase(): string {
	const baseApi = import.meta.env.VITE_APP_BASE_API ?? "/api";
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	return baseApi.startsWith("http")
		? baseApi.replace(/\/$/, "")
		: `${origin}${baseApi}`.replace(/\/$/, "");
}

/** Swagger UI URL */
export function getSwaggerUrl(): string {
	const baseApi = import.meta.env.VITE_APP_BASE_API ?? "/api";
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	// 로컬 개발: Vite 프록시가 /api-docs → 백엔드로 전달
	if (!baseApi.startsWith("http")) {
		return `${origin}/api-docs`;
	}
	if (baseApi.endsWith("/api")) {
		return `${baseApi.slice(0, -4)}/api-docs`;
	}
	return `${baseApi.replace(/\/api\/?$/, "")}/api-docs`;
}

export function loginIdentifierToScope(loginIdentifier?: string): string {
	if (loginIdentifier === "both") return "email,phone";
	if (loginIdentifier === "phone") return "phone";
	return "email";
}

export interface BuildAuthorizeUrlParams {
	clientId: string;
	redirectUri: string;
	scope?: string;
	state?: string;
	email?: string;
	lang?: "ko" | "en";
}

/** Callback URL에서 백엔드 로그인 시작 URL 추론 (예: …/api/auth/callback → …/api/auth/login) */
export function deriveBackendLoginUrl(callbackUrl?: string): string {
	const fallback = "https://your-site.com/api/auth/login";
	if (!callbackUrl?.trim()) return fallback;
	try {
		const url = new URL(callbackUrl.trim());
		if (url.pathname.endsWith("/callback")) {
			url.pathname = url.pathname.replace(/\/callback\/?$/, "/login");
		} else if (!url.pathname.includes("/login")) {
			url.pathname = "/api/auth/login";
		}
		url.search = "";
		url.hash = "";
		return url.toString();
	} catch {
		return fallback;
	}
}

export interface BuildBackendLoginUrlParams {
	callbackUrl?: string;
	email?: string;
	lang?: "ko" | "en";
	returnTo?: string;
}

/** 프론트엔드 로그인 버튼용 — 자체 백엔드 /api/auth/login 으로만 이동 (키 노출 없음) */
export function buildBackendLoginUrl(params: BuildBackendLoginUrlParams = {}): string {
	const base = deriveBackendLoginUrl(params.callbackUrl);
	const q = new URLSearchParams();
	if (params.email?.trim()) q.set("email", params.email.trim());
	if (params.lang) q.set("lang", params.lang);
	if (params.returnTo?.trim()) q.set("return_to", params.returnTo.trim());
	const qs = q.toString();
	return qs ? `${base}?${qs}` : base;
}

/** GET /api/web/authorize URL 생성 (서버에서만 사용 권장) */
export function buildAuthorizeUrl(params: BuildAuthorizeUrlParams): string {
	const base = getApiBase();
	const state = params.state ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : "state");
	const q = new URLSearchParams({
		client_id: params.clientId,
		redirect_uri: params.redirectUri,
		response_type: "code",
		scope: params.scope ?? "email",
		state,
		lang: params.lang ?? "ko",
	});
	if (params.email?.trim()) {
		q.set("email", params.email.trim());
	}
	return `${base}/web/authorize?${q.toString()}`;
}

export function buildCallbackExampleUrl(callbackUrl?: string): string {
	const baseUrl = callbackUrl?.trim() || "https://example.com/callback";
	try {
		const url = new URL(baseUrl);
		url.searchParams.set("code", "AUTH_CODE");
		url.searchParams.set("state", "STATE_VALUE");
		return url.toString();
	} catch {
		const separator = baseUrl.includes("?") ? "&" : "?";
		return `${baseUrl}${separator}code=AUTH_CODE&state=STATE_VALUE`;
	}
}

/** 앱 loginIdentifier + callbackUrl 정규화 (camelCase/snake_case) */
export function normalizeApplicationFields(app: {
	clientId?: string;
	client_id?: string;
	callbackUrl?: string;
	callback_url?: string;
	loginIdentifier?: string;
	login_identifier?: string;
}) {
	return {
		clientId: app.clientId ?? app.client_id ?? "",
		callbackUrl: app.callbackUrl ?? app.callback_url ?? "",
		loginIdentifier: app.loginIdentifier ?? app.login_identifier ?? "email",
	};
}
