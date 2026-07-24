import { Button } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { toast } from "sonner";

import type { Application } from "@/api/services/application";
import { t } from "@/locales/i18n";
import {
	buildBackendLoginUrl,
	normalizeApplicationFields,
} from "@/utils/bioPassApi";

import { useSampleLocale } from "./useSampleLocale";

interface TestLoginButtonProps {
	application: Application | null;
}

export function TestLoginButton({ application }: TestLoginButtonProps) {
	const sampleLocale = useSampleLocale();

	const handleTest = () => {
		if (!application) {
			toast.error(t("sys.menu.developer.selectAppFirst"));
			return;
		}
		const { callbackUrl } = normalizeApplicationFields(application);
		if (!callbackUrl) {
			toast.error(t("sys.menu.developer.callbackRequired"));
			return;
		}
		const email = prompt(t("sys.menu.developer.testEmailPrompt"), "");
		if (!email?.trim()) {
			toast.error(t("sys.menu.developer.testEmailRequired"));
			return;
		}
		const url = buildBackendLoginUrl({
			callbackUrl,
			email: email.trim(),
			lang: sampleLocale,
		});
		window.open(url, "_blank", "noopener,noreferrer");
	};

	return (
		<Button type="primary" icon={<LinkOutlined />} onClick={handleTest} disabled={!application}>
			{t("sys.menu.developer.testLogin")}
		</Button>
	);
}
