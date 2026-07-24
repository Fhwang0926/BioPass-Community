import { Card, Steps, Typography, Alert, Space } from "antd";
import { useState } from "react";
import { RocketOutlined } from "@ant-design/icons";
import { Link } from "react-router";

import { t } from "@/locales/i18n";
import type { Application } from "@/api/services/application";

import { AppSelector } from "./components/AppSelector";
import { CodeBlock } from "./components/CodeBlock";
import {
	IntegrationProvider,
	useIntegrationVars,
} from "./components/IntegrationContext";
import {
	backendCallbackSample,
	curlAuthorizeSample,
	frontendLoginSample,
} from "./components/integrationSamples";
import { useSampleLocale } from "./components/useSampleLocale";
import { TestLoginButton } from "./components/TestLoginButton";

const { Title, Paragraph, Text } = Typography;

function QuickStartContent() {
	const [currentStep, setCurrentStep] = useState(0);
	const [selectedApp, setSelectedApp] = useState<Application | null>(null);

	return (
		<IntegrationProvider application={selectedApp}>
			<QuickStartSteps
				currentStep={currentStep}
				onStepChange={setCurrentStep}
				selectedApp={selectedApp}
				onAppChange={setSelectedApp}
			/>
		</IntegrationProvider>
	);
}

function QuickStartSteps({
	currentStep,
	onStepChange,
	selectedApp,
	onAppChange,
}: {
	currentStep: number;
	onStepChange: (step: number) => void;
	selectedApp: Application | null;
	onAppChange: (app: Application | null) => void;
}) {
	const vars = useIntegrationVars();
	const sampleLocale = useSampleLocale();

	const steps = [
		{
			title: t("sys.menu.developer.step1Title"),
			description: (
				<div>
					<p>{t("sys.menu.developer.step1Desc")}</p>
					<p style={{ color: "#1890ff" }}>{t("sys.menu.developer.step1Hint")}</p>
					<Link to="/service/application/create">
						{t("sys.menu.developer.createAppLink")} →
					</Link>
				</div>
			),
		},
		{
			title: t("sys.menu.developer.step2Title"),
			description: (
				<div>
					<Alert
						type="info"
						showIcon
						message={t("sys.menu.developer.noSdkNeeded")}
						style={{ marginBottom: 16 }}
					/>
					<AppSelector value={selectedApp} onChange={onAppChange} />
					{selectedApp && (
						<div style={{ marginTop: 16 }}>
							<TestLoginButton application={selectedApp} />
						</div>
					)}
				</div>
			),
		},
		{
			title: t("sys.menu.developer.step3Title"),
			description: (
				<div>
					<Alert
						type="info"
						showIcon
						message={t("sys.menu.developer.backendFirstFlowNote")}
						style={{ marginBottom: 16 }}
					/>
					{!vars.hasApp && (
						<Alert type="warning" showIcon message={t("sys.menu.developer.selectAppForSamples")} style={{ marginBottom: 16 }} />
					)}
					<Text strong>{t("sys.menu.developer.sampleFrontend")}</Text>
					<CodeBlock code={frontendLoginSample(vars, sampleLocale)} language="javascript" />
					<Text strong>{t("sys.menu.developer.sampleBackend")}</Text>
					<CodeBlock code={backendCallbackSample(vars, sampleLocale)} language="javascript" />
					<Text strong>{t("sys.menu.developer.sampleCurl")}</Text>
					<CodeBlock code={curlAuthorizeSample(vars, sampleLocale)} language="bash" />
					<Alert
						type="warning"
						showIcon
						message={t("sys.menu.developer.secretServerOnly")}
						style={{ marginTop: 8 }}
					/>
				</div>
			),
		},
	];

	return (
		<Steps
			current={currentStep}
			onChange={onStepChange}
			direction="vertical"
			size="small"
			items={steps}
		/>
	);
}

export default function DeveloperQuickStartPage() {
	return (
		<Card>
			<div style={{ marginBottom: 24 }}>
				<Title level={2}>
					<RocketOutlined style={{ fontSize: 32, marginRight: 8 }} />
					{t("sys.menu.developer.quickStartTitle")}
				</Title>
				<Paragraph>{t("sys.menu.developer.quickStartIntro")}</Paragraph>
				<Space>
					<Link to="/developer/docs">{t("sys.menu.developer.fullDocsLink")}</Link>
				</Space>
			</div>
			<QuickStartContent />
		</Card>
	);
}
