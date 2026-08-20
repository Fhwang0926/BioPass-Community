import { Iconify } from "@/components/icon";
import LocalePicker from "@/components/locale-picker";
import { Button, Divider, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const { Paragraph, Text, Title } = Typography;

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "admin@localhost";
const LAST_UPDATED = "2026-07-19";

type LegalSection = {
	title: string;
	body?: string;
	items?: string[];
};

const koPrivacySections: LegalSection[] = [
	{
		title: "1. 적용 범위",
		body: "본 개인정보 처리방침은 셀프호스팅된 BioPass Community 웹 콘솔, 모바일 인증 앱, OAuth/API 인증 흐름을 이용할 때 처리되는 개인정보에 적용됩니다. 실제 운영 주체는 소프트웨어를 배포·운영하는 조직입니다.",
	},
	{
		title: "2. 처리하는 개인정보",
		items: [
			"계정 정보: 이메일, 이름, 비밀번호 해시, 권한, 조직 식별자, 선택적으로 전화번호 및 프로필 이미지",
			"애플리케이션 설정: 앱 이름, client_id, client_secret, callback URL, 인증 만료/제한 설정",
			"인증 및 보안 로그: 인증 요청 ID, 상태, 앱/사용자 식별자, IP, 국가, User-Agent, 위험 이벤트",
			"기기 정보: 플랫폼, 기기 이름, 기기 식별자, 푸시 토큰, 생체 인증 가능 여부",
			"운영 로그: 이메일 발송 로그, 감사 로그, 시스템 알림 기록",
		],
	},
	{
		title: "3. 생체 정보에 대한 고지",
		items: [
			"BioPass 서버는 지문·얼굴 이미지, 생체 템플릿 또는 생체 원본 데이터를 저장하지 않도록 설계되어 있습니다.",
			"생체 인증은 사용자 기기와 OS 보안 기능을 통해 수행되며, 서버에는 인증 결과와 기기 등록에 필요한 최소 정보만 저장됩니다.",
		],
	},
	{
		title: "4. 이용 목적",
		items: [
			"회원가입, 로그인, 계정 및 조직 관리",
			"OAuth/API 인증 요청 생성·승인·토큰 발급 및 검증",
			"기기 등록, 푸시 알림, 계정 보호",
			"보안 정책 적용, 부정 사용 탐지, 감사 로그 및 장애 분석",
		],
	},
	{
		title: "5. 제3자 제공",
		items: [
			"이메일 발송·푸시 알림·데이터베이스 등 운영자가 선택한 인프라 제공자가 제한적으로 개인정보를 처리할 수 있습니다.",
		],
	},
	{
		title: "6. 보관·보안·문의",
		items: [
			"개인정보는 서비스 제공·보안·감사·법적 의무에 필요한 기간 동안 보관됩니다.",
			"비밀번호 해시, JWT 기반 인증, 접근 권한 관리, 감사 로그 등 합리적인 보호 조치를 적용합니다.",
			`문의: ${CONTACT_EMAIL}`,
		],
	},
];

const koTermsSections: LegalSection[] = [
	{
		title: "1. 약관의 적용",
		body: "본 약관은 BioPass Community 소프트웨어를 셀프호스팅하여 제공하는 웹 콘솔, 모바일 인증 앱, API, OAuth 기능을 이용하는 사용자와 조직에 적용됩니다.",
	},
	{
		title: "2. 서비스 내용",
		items: [
			"이메일/기기 기반 인증, 모바일 생체 인증 승인, OAuth/API 연동, 애플리케이션 관리, 인증 로그, 보안 정책 기능을 제공합니다.",
			"생체 인증은 사용자 기기 및 OS 보안 기능을 이용하며, BioPass는 인증 요청과 결과를 처리합니다.",
			"본 배포판에는 상용 클라우드 결제·구독 기능이 포함되어 있지 않습니다.",
		],
	},
	{
		title: "3. 계정과 조직 관리",
		items: [
			"사용자는 계정 정보와 토큰, client_secret, 기기 secret을 안전하게 관리해야 합니다.",
			"조직 관리자는 소속 사용자, 앱, callback URL, 보안 정책, 권한 설정을 관리할 책임이 있습니다.",
		],
	},
	{
		title: "4. 허용되는 사용",
		items: [
			"서비스는 합법적인 인증·계정 보호·보안 목적에 한해 사용해야 합니다.",
			"무단 접근, 스팸, 피싱, 악성 코드, 취약점 악용, 과도한 트래픽, 법령 위반 행위는 금지됩니다.",
		],
	},
	{
		title: "5. 오픈소스 라이선스",
		body: "BioPass Community 소스 코드는 저장소 루트의 LICENSE(Apache-2.0) 및 NOTICE에 따릅니다. 관리자 UI는 slash-admin 템플릿(MIT)을 기반으로 합니다.",
	},
	{
		title: "6. 보증·책임의 제한",
		body: "소프트웨어는 현재 제공되는 상태로 제공되며, 법령이 허용하는 범위에서 명시적·묵시적 보증을 하지 않습니다. 셀프호스팅 환경의 보안·가용성·백업은 운영 주체의 책임입니다.",
	},
	{
		title: "7. 문의",
		body: `약관, 개인정보, 보안 관련 문의: ${CONTACT_EMAIL}`,
	},
];

const enPrivacySections: LegalSection[] = [
	{
		title: "1. Scope",
		body: "This Privacy Policy applies to personal information processed through the self-hosted BioPass Community web console, mobile authentication app, and OAuth/API authentication flows. The organization deploying and operating the software is the actual service operator.",
	},
	{
		title: "2. Personal information we process",
		items: [
			"Account data: email, name, password hash, permissions, organization identifier, and optional phone number and profile image",
			"Application settings: app name, client_id, client_secret, callback URL, and authentication expiry and limit settings",
			"Authentication and security logs: request ID, status, app/user identifiers, IP address, country, User-Agent, and risk events",
			"Device data: platform, device name and identifier, push token, and biometric availability",
			"Operational logs: email delivery, audit, and system notification records",
		],
	},
	{
		title: "3. Biometric data notice",
		items: [
			"BioPass servers are designed not to store fingerprint or face images, biometric templates, or raw biometric data.",
			"Biometric verification occurs through the user's device and operating-system security features. The server stores only the minimum data needed for the result and device registration.",
		],
	},
	{
		title: "4. Purposes of processing",
		items: [
			"Registration, sign-in, account, and organization management",
			"OAuth/API request creation, approval, token issuance, and verification",
			"Device registration, push notifications, and account protection",
			"Security policy enforcement, abuse detection, auditing, and incident analysis",
		],
	},
	{
		title: "5. Third-party processing",
		items: [
			"Infrastructure providers selected by the operator, such as email, push notification, and database providers, may process limited personal information.",
		],
	},
	{
		title: "6. Retention, security, and contact",
		items: [
			"Personal information is retained as needed to provide the service and meet security, audit, and legal obligations.",
			"Reasonable safeguards include password hashing, JWT-based authentication, access control, and audit logs.",
			`Contact: ${CONTACT_EMAIL}`,
		],
	},
];

const enTermsSections: LegalSection[] = [
	{
		title: "1. Application of terms",
		body: "These terms apply to users and organizations using the web console, mobile authentication app, API, and OAuth features provided through a self-hosted BioPass Community deployment.",
	},
	{
		title: "2. Service",
		items: [
			"The service provides email/device authentication, mobile biometric approval, OAuth/API integration, application management, authentication logs, and security policy features.",
			"Biometric verification uses the user's device and operating-system security features; BioPass processes authentication requests and results.",
			"This distribution does not include commercial cloud billing or subscription features.",
		],
	},
	{
		title: "3. Account and organization management",
		items: [
			"Users must securely manage account information, tokens, client_secret values, and device secrets.",
			"Organization administrators are responsible for users, apps, callback URLs, security policies, permissions, and related settings.",
		],
	},
	{
		title: "4. Acceptable use",
		items: [
			"The service may be used only for lawful authentication, account protection, and security purposes.",
			"Unauthorized access, spam, phishing, malware, vulnerability exploitation, excessive traffic, and unlawful conduct are prohibited.",
		],
	},
	{
		title: "5. Open-source license",
		body: "BioPass Community source code is governed by the repository's LICENSE (Apache-2.0) and NOTICE. The admin UI is based on the slash-admin template (MIT).",
	},
	{
		title: "6. Disclaimer and limitation of liability",
		body: "The software is provided as is, without express or implied warranties to the extent permitted by law. The operator is responsible for the security, availability, and backups of its self-hosted environment.",
	},
	{ title: "7. Contact", body: `Questions about these terms, privacy, or security: ${CONTACT_EMAIL}` },
];

function LegalDocument({
	title,
	description,
	sections,
}: {
	title: string;
	description: string;
	sections: LegalSection[];
}) {
	const { t } = useTranslation();
	return (
		<div className="relative mx-auto max-w-3xl px-4 py-10">
			<div className="mb-6 flex justify-end">
				<LocalePicker variant="labeled" />
			</div>
			<Title level={2}>{title}</Title>
			<Paragraph type="secondary">{description}</Paragraph>
			<Text type="secondary">
				{t("sys.legal.lastUpdated")}: {LAST_UPDATED}
			</Text>
			<Divider />
			{sections.map((section) => (
				<div key={section.title} className="mb-8">
					<Title level={4}>{section.title}</Title>
					{section.body && <Paragraph>{section.body}</Paragraph>}
					{section.items && (
						<ul className="list-disc space-y-2 pl-5">
							{section.items.map((item) => (
								<li key={item}>
									<Text>{item}</Text>
								</li>
							))}
						</ul>
					)}
				</div>
			))}
			<Link to="/welcome">
				<Button icon={<Iconify icon="solar:arrow-left-linear" size={18} />}>{t("common.back")}</Button>
			</Link>
		</div>
	);
}

export function PrivacyPolicyPage() {
	const { t, i18n } = useTranslation();
	const useKoreanLegal = i18n.resolvedLanguage === "ko_KR";
	return (
		<LegalDocument
			title={t("sys.legal.privacy.title")}
			description={t("sys.legal.privacy.description")}
			sections={useKoreanLegal ? koPrivacySections : enPrivacySections}
		/>
	);
}

export function TermsOfServicePage() {
	const { t, i18n } = useTranslation();
	const useKoreanLegal = i18n.resolvedLanguage === "ko_KR";
	return (
		<LegalDocument
			title={t("sys.legal.terms.title")}
			description={t("sys.legal.terms.description")}
			sections={useKoreanLegal ? koTermsSections : enTermsSections}
		/>
	);
}

export default PrivacyPolicyPage;
