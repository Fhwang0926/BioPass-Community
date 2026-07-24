import { Card, Typography, Tabs, Alert, Space, Button } from "antd";
import { FileTextOutlined, ExportOutlined } from "@ant-design/icons";
import { useState } from "react";
import { Link } from "react-router";

import { AuthFlowParamsCollapse } from "@/components/auth-flow/AuthFlowParamsCollapse";
import type { Application } from "@/api/services/application";
import { t } from "@/locales/i18n";
import { getSwaggerUrl } from "@/utils/bioPassApi";

import { AppSelector } from "./components/AppSelector";
import { CodeBlock } from "./components/CodeBlock";
import {
	IntegrationProvider,
	useIntegrationVars,
} from "./components/IntegrationContext";
import {
	backendCallbackSample,
	callbackPageSample,
	apiReferenceSample,
	errorCodesSample,
	frontendLoginSample,
	verifyTokenSample,
} from "./components/integrationSamples";
import { useSampleLocale } from "./components/useSampleLocale";
import { TestLoginButton } from "./components/TestLoginButton";

const { Title, Paragraph } = Typography;

function DocsTabs() {
	const [selectedApp, setSelectedApp] = useState<Application | null>(null);

	return (
		<IntegrationProvider application={selectedApp}>
			<Space direction="vertical" size="large" className="w-full" style={{ marginBottom: 24 }}>
				<AppSelector value={selectedApp} onChange={setSelectedApp} />
				<TestLoginButton application={selectedApp} />
			</Space>
			<DocsTabContent />
		</IntegrationProvider>
	);
}

function DocsTabContent() {
	const vars = useIntegrationVars();
	const sampleLocale = useSampleLocale();
	const swaggerUrl = getSwaggerUrl();

	const tabItems = [
		{
			key: "flow",
			label: t("sys.menu.developer.tabFlow"),
			children: (
				<div>
					<Paragraph>{t("sys.menu.developer.tabFlowDesc")}</Paragraph>
					<Alert
						type="info"
						showIcon
						message={t("sys.menu.developer.backendFirstFlowNote")}
						style={{ marginBottom: 16 }}
					/>
					<Alert
						type="warning"
						showIcon
						message={t("sys.menu.developer.callbackUrlNote")}
						style={{ marginBottom: 16 }}
					/>
					<AuthFlowParamsCollapse />
				</div>
			),
		},
		{
			key: "frontend",
			label: t("sys.menu.developer.tabFrontend"),
			children: (
				<div>
					<Paragraph>{t("sys.menu.developer.tabFrontendDesc")}</Paragraph>
					<CodeBlock code={frontendLoginSample(vars, sampleLocale)} language="javascript" />
					<CodeBlock code={callbackPageSample(vars, sampleLocale)} language="javascript" />
				</div>
			),
		},
		{
			key: "backend",
			label: t("sys.menu.developer.tabBackend"),
			children: (
				<div>
					<Paragraph>{t("sys.menu.developer.tabBackendDesc")}</Paragraph>
					<Alert type="warning" showIcon message={t("sys.menu.developer.secretServerOnly")} style={{ marginBottom: 16 }} />
					<CodeBlock code={backendCallbackSample(vars, sampleLocale)} language="javascript" />
					<Paragraph>{t("sys.menu.developer.verifyTokenDesc")}</Paragraph>
					<CodeBlock code={verifyTokenSample(vars, sampleLocale)} language="http" />
				</div>
			),
		},
		{
			key: "reference",
			label: t("sys.menu.developer.tabReference"),
			children: (
				<div>
					<Paragraph>{t("sys.menu.developer.tabReferenceDesc")}</Paragraph>
					<Button
						type="link"
						icon={<ExportOutlined />}
						href={swaggerUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{ padding: 0, marginBottom: 16 }}
					>
						{t("sys.menu.developer.swaggerLink")} ({swaggerUrl})
					</Button>
					<CodeBlock code={apiReferenceSample(sampleLocale)} language="text" />
				</div>
			),
		},
		{
			key: "errors",
			label: t("sys.menu.developer.tabErrors"),
			children: (
				<div>
					<Paragraph>{t("sys.menu.developer.tabErrorsDesc")}</Paragraph>
					<CodeBlock code={errorCodesSample(sampleLocale)} language="json" />
				</div>
			),
		},
	];

	return <Tabs defaultActiveKey="flow" items={tabItems} />;
}

export default function DeveloperDocsPage() {
	return (
		<Card>
			<Title level={2}>
				<FileTextOutlined style={{ fontSize: 32, marginRight: 8 }} />
				{t("sys.menu.developer.docsTitle")}
			</Title>
			<Paragraph>
				{t("sys.menu.developer.docsIntro")}{" "}
				<Link to="/developer/quick-start">{t("sys.menu.developer.quickStart")}</Link>
			</Paragraph>
			<DocsTabs />
		</Card>
	);
}
