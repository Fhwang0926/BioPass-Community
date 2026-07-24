import { Collapse } from "antd";
import { useTranslation } from "react-i18next";

import type { AuthFlowStep } from "./AuthFlowDiagram";
import { AuthFlowDiagram } from "./AuthFlowDiagram";

export function AuthFlowParamsCollapse() {
	const { t, i18n } = useTranslation();
	const ns = "sys.menu.application.detailPage";
	const req = (v: boolean) => t(v ? `${ns}.auth_flow_required_yes` : `${ns}.auth_flow_required_no`);
	const cols = [
		{ title: t(`${ns}.auth_flow_table_param`), dataIndex: "name", key: "name", width: 140, render: (v: string) => <code>{v}</code> },
		{ title: t(`${ns}.auth_flow_table_required`), dataIndex: "required", key: "required", width: 72, render: (v: boolean) => req(v) },
		{ title: t(`${ns}.auth_flow_table_desc`), dataIndex: "desc", key: "desc" },
	];

	const authorizeData = [
		{ key: "1", name: "client_id", required: true, desc: t(`${ns}.auth_flow_param_client_id`) },
		{ key: "2", name: "redirect_uri", required: true, desc: t(`${ns}.auth_flow_param_redirect_uri`) },
		{ key: "3", name: "response_type", required: true, desc: t(`${ns}.auth_flow_param_response_type`) },
		{ key: "4", name: "scope", required: false, desc: t(`${ns}.auth_flow_param_scope`) },
		{ key: "5", name: "state", required: false, desc: t(`${ns}.auth_flow_param_state`) },
		{ key: "6", name: "email", required: false, desc: t(`${ns}.auth_flow_param_email`) },
		{ key: "7", name: "phone", required: false, desc: t(`${ns}.auth_flow_param_phone`) },
		{ key: "8", name: "phone_origin", required: false, desc: t(`${ns}.auth_flow_param_phone_origin`) },
		{ key: "9", name: "lang", required: false, desc: t(`${ns}.auth_flow_param_lang`) },
	];
	const requestEmailCodeData = [
		{ key: "1", name: "client_id", required: true, desc: t(`${ns}.auth_flow_param_request_email_client_id`) },
		{ key: "2", name: "redirect_uri", required: true, desc: t(`${ns}.auth_flow_param_request_email_redirect_uri`) },
		{ key: "3", name: "email", required: true, desc: t(`${ns}.auth_flow_param_request_email_email`) },
	];
	const verifyGetData = [
		{ key: "1", name: "request_id", required: true, desc: t(`${ns}.auth_flow_param_request_id`) },
		{ key: "2", name: "email", required: true, desc: t(`${ns}.auth_flow_param_email_verify`) },
		{ key: "3", name: "redirect_uri", required: true, desc: t(`${ns}.auth_flow_param_redirect_uri_verify`) },
		{ key: "4", name: "state", required: false, desc: t(`${ns}.auth_flow_param_state_verify`) },
		{ key: "5", name: "app_name", required: false, desc: t(`${ns}.auth_flow_param_app_name`) },
	];
	const verifyPostData = [
		{ key: "1", name: "request_id", required: true, desc: t(`${ns}.auth_flow_param_request_id`) },
		{ key: "2", name: "email", required: true, desc: t(`${ns}.auth_flow_param_email_verify`) },
		{ key: "3", name: "code", required: true, desc: t(`${ns}.auth_flow_param_code_6`) },
		{ key: "4", name: "redirect_uri", required: true, desc: t(`${ns}.auth_flow_param_redirect_uri_state_note`) },
		{ key: "5", name: "state", required: false, desc: t(`${ns}.auth_flow_param_redirect_uri_state_note`) },
	];
	const mobileWaitData = [
		{ key: "1", name: "request_id", required: true, desc: t(`${ns}.auth_flow_param_request_id`) },
		{ key: "2", name: "redirect_uri", required: true, desc: t(`${ns}.auth_flow_param_redirect_uri_verify`) },
		{ key: "3", name: "state", required: false, desc: t(`${ns}.auth_flow_param_state_verify`) },
		{ key: "4", name: "scope", required: false, desc: t(`${ns}.auth_flow_param_scope`) },
	];
	const authStatusData = [
		{ key: "1", name: "request_id", required: true, desc: t(`${ns}.auth_flow_param_auth_status_request_id`) },
		{ key: "2", name: "redirect_uri", required: true, desc: t(`${ns}.auth_flow_param_auth_status_redirect_uri`) },
		{ key: "3", name: "state", required: false, desc: t(`${ns}.auth_flow_param_auth_status_state`) },
		{ key: "4", name: "lang", required: false, desc: t(`${ns}.auth_flow_param_lang`) },
	];
	const resendEmailData = [
		{ key: "1", name: "email", required: true, desc: t(`${ns}.auth_flow_param_resend_email`) },
		{ key: "2", name: "client_id", required: false, desc: t(`${ns}.auth_flow_param_client_id`) },
		{ key: "3", name: "redirect_uri", required: false, desc: t(`${ns}.auth_flow_param_redirect_uri_verify`) },
		{ key: "4", name: "state", required: false, desc: t(`${ns}.auth_flow_param_state_verify`) },
	];
	const notifyResendData = [
		{ key: "1", name: "request_id", required: true, desc: t(`${ns}.auth_flow_param_request_id`) },
	];
	const callbackData = [
		{ key: "1", name: "code", required: true, desc: t(`${ns}.auth_flow_param_code_callback`) },
		{ key: "2", name: "state", required: false, desc: t(`${ns}.auth_flow_param_state_callback`) },
	];
	const tokenData = [
		{ key: "1", name: "grant_type", required: true, desc: t(`${ns}.auth_flow_param_grant_type`) },
		{ key: "2", name: "code", required: true, desc: t(`${ns}.auth_flow_param_code_token`) },
		{ key: "3", name: "client_id", required: true, desc: t(`${ns}.auth_flow_param_client_id_token`) },
		{ key: "4", name: "client_secret", required: true, desc: t(`${ns}.auth_flow_param_client_secret`) },
		{ key: "5", name: "code_verifier", required: false, desc: t(`${ns}.auth_flow_param_code_verifier`) },
		{ key: "6", name: "redirect_uri", required: false, desc: t(`${ns}.auth_flow_param_redirect_uri_token`) },
	];
	const tokenResData = [
		{ key: "1", name: "access_token", required: false, desc: t(`${ns}.auth_flow_param_access_token`) },
		{ key: "2", name: "token_type", required: false, desc: t(`${ns}.auth_flow_param_token_type`) },
		{ key: "3", name: "expires_in", required: false, desc: t(`${ns}.auth_flow_param_expires_in`) },
		{ key: "4", name: "refresh_token", required: false, desc: t(`${ns}.auth_flow_param_refresh_token`) },
		{ key: "5", name: "scope", required: false, desc: t(`${ns}.auth_flow_param_scope_res`) },
	];
	const verifyTokenData = [
		{ key: "1", name: "token", required: true, desc: t(`${ns}.auth_flow_param_verify_token_token`) },
		{ key: "2", name: "client_id", required: true, desc: t(`${ns}.auth_flow_param_verify_token_client_id`) },
		{ key: "3", name: "client_secret", required: true, desc: t(`${ns}.auth_flow_param_verify_token_client_secret`) },
	];

	const steps: AuthFlowStep[] = [
		{ id: "step1", label: t(`${ns}.auth_flow_step_1`), pathType: "common", params: authorizeData },
		{ id: "step1alt", label: t(`${ns}.auth_flow_step_1_alt`), pathType: "email", params: requestEmailCodeData },
		{ id: "step2", label: t(`${ns}.auth_flow_step_2`), pathType: "email", params: verifyGetData },
		{ id: "step3", label: t(`${ns}.auth_flow_step_3`), pathType: "email", params: verifyPostData },
		{ id: "step1mobile", label: t(`${ns}.auth_flow_step_1_mobile`), pathType: "mobile", params: mobileWaitData },
		{ id: "stepAuthStatus", label: t(`${ns}.auth_flow_step_auth_status`), pathType: "mobile", params: authStatusData },
		{ id: "stepNotifyResend", label: t(`${ns}.auth_flow_step_notify_resend`), pathType: "mobile", params: notifyResendData },
		{ id: "stepResendEmail", label: t(`${ns}.auth_flow_step_resend_email`), pathType: "email", params: resendEmailData },
		{ id: "step4", label: t(`${ns}.auth_flow_step_4`), pathType: "common", params: callbackData },
		{ id: "step5", label: t(`${ns}.auth_flow_step_5`), pathType: "common", params: tokenData },
		{ id: "step6", label: t(`${ns}.auth_flow_step_6`), pathType: "common", params: tokenResData },
		{ id: "step7", label: t(`${ns}.auth_flow_step_7`), pathType: "common", params: verifyTokenData },
	];

	return (
		<Collapse
			style={{ marginTop: "12px" }}
			items={[
				{
					key: "1",
					label: <span style={{ fontWeight: 600 }}>{t(`${ns}.auth_flow_params_title`)}</span>,
					children: (
						<div style={{ padding: "4px 0" }}>
							<p style={{ marginBottom: "8px", color: "#595959" }}>{t(`${ns}.auth_flow_params_intro`)}</p>
							<p style={{ marginBottom: "12px", padding: "8px 12px", background: "#f0f7ff", borderRadius: 8, fontSize: 13, color: "#1d3b6c", border: "1px solid #bae0ff" }}>
								{t(`${ns}.auth_flow_branch_intro`)}
							</p>
							<AuthFlowDiagram key={i18n.language} steps={steps} columns={cols} />
						</div>
					),
				},
			]}
		/>
	);
}
