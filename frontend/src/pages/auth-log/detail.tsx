import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import {
	Button,
	Card,
	Space,
	Tag,
	Descriptions,
	Alert,
} from "antd";
import dayjs from "@/utils/dayjs";

import { Iconify } from "@/components/icon";
import authLogService from "@/api/services/auth-log";

export default function AuthLogDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const { data: authLog, isLoading } = useQuery({
		queryKey: ["auth-log", id],
		queryFn: () => authLogService.getAuthLog(id || ""),
		enabled: !!id,
	});

	if (isLoading) {
		return <div>로딩 중...</div>;
	}

	if (!authLog) {
		return <div>인증 로그를 찾을 수 없습니다.</div>;
	}

	const getStatusTag = (status: string) => {
		const statusMap: Record<string, { color: string; text: string }> = {
			APPROVED: { color: "success", text: "승인" },
			DENIED: { color: "error", text: "거절" },
			EXPIRED: { color: "warning", text: "만료" },
			BLOCKED: { color: "error", text: "차단" },
			PENDING: { color: "processing", text: "대기" },
			CONSUMED: { color: "default", text: "사용됨" },
		};
		const statusInfo = statusMap[status] || { color: "default", text: status };
		return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
	};

	const getEventLabel = (eventType: string) => {
		const labelMap: Record<string, string> = {
			CREATED: "인증 요청 생성",
			PENDING: "대기 중",
			EMAIL_CODE_SENT: "이메일 인증 코드 발송",
			APPROVED_BY_DEVICE: "디바이스(바이오) 승인",
			APPROVED_BY_EMAIL: "이메일 인증 완료",
			APPROVED: "승인",
			DENIED: "거절",
			EXPIRED_BY_SYSTEM: "시간 만료",
			EXPIRED_BY_RESEND: "재전송으로 만료",
			BLOCKED: "차단",
			CONSUMED: "코드 사용됨",
		};
		return labelMap[eventType] || eventType;
	};

	const getEventIcon = (eventType: string) => {
		const iconMap: Record<string, string> = {
			CREATED: "solar:document-add-bold-duotone",
			PENDING: "solar:clock-circle-bold-duotone",
			EMAIL_CODE_SENT: "solar:letter-bold-duotone",
			APPROVED_BY_DEVICE: "solar:smartphone-bold-duotone",
			APPROVED_BY_EMAIL: "solar:letter-opened-bold-duotone",
			APPROVED: "solar:check-circle-bold-duotone",
			PUSH_SENT: "solar:bell-bold-duotone",
			DENIED: "solar:close-circle-bold-duotone",
			EXPIRED: "solar:clock-circle-bold-duotone",
			EXPIRED_BY_SYSTEM: "solar:clock-circle-bold-duotone",
			EXPIRED_BY_RESEND: "solar:refresh-circle-bold-duotone",
			BLOCKED: "solar:shield-warning-bold-duotone",
			CONSUMED: "solar:check-circle-bold-duotone",
		};
		return iconMap[eventType] || "solar:circle-bold-duotone";
	};

	const getEventColor = (eventType: string) => {
		const colorMap: Record<string, string> = {
			CREATED: "blue",
			PENDING: "blue",
			EMAIL_CODE_SENT: "cyan",
			APPROVED_BY_DEVICE: "green",
			APPROVED_BY_EMAIL: "green",
			APPROVED: "green",
			PUSH_SENT: "cyan",
			DENIED: "red",
			EXPIRED: "orange",
			EXPIRED_BY_SYSTEM: "orange",
			EXPIRED_BY_RESEND: "orange",
			BLOCKED: "red",
			CONSUMED: "default",
		};
		return colorMap[eventType] || "gray";
	};

	const getEventNodeStyle = (eventType: string) => {
		const color = getEventColor(eventType);
		const styleMap: Record<string, { border: string; bg: string; icon: string }> = {
			blue: { border: "#91caff", bg: "#e6f4ff", icon: "#1677ff" },
			cyan: { border: "#87e8de", bg: "#e6fffb", icon: "#13c2c2" },
			green: { border: "#95de64", bg: "#f6ffed", icon: "#52c41a" },
			red: { border: "#ffa39e", bg: "#fff2f0", icon: "#ff4d4f" },
			orange: { border: "#ffd591", bg: "#fff7e6", icon: "#fa8c16" },
			gray: { border: "#d9d9d9", bg: "#fafafa", icon: "#8c8c8c" },
			default: { border: "#d9d9d9", bg: "#fafafa", icon: "#8c8c8c" },
		};
		return styleMap[color] ?? styleMap.gray;
	};

	/** 디바이스 유형 한글 라벨 (이메일 인증 완료 시) */
	const getDeviceTypeLabel = (deviceType: string) => {
		const map: Record<string, string> = { PC: "PC", Mobile: "모바일", App: "앱" };
		return map[deviceType] ?? deviceType;
	};

	/** User-Agent에서 브라우저/환경 요약 문자열 추출 */
	const parseUserAgentLabel = (ua: string): string => {
		if (!ua || typeof ua !== "string") return "";
		const s = ua;
		// 브라우저 이름 추출 (간단한 패턴)
		const chrome = s.match(/Chrome\/(\d+)/)?.[1];
		const safari = s.match(/Version\/(\d+).*Safari/)?.[1] || s.match(/Safari\/(\d+)/)?.[1];
		const firefox = s.match(/Firefox\/(\d+)/)?.[1];
		const edge = s.match(/Edg\/(\d+)/)?.[1];
		const msie = s.match(/MSIE (\d+)/)?.[1] || s.match(/Trident\/.*rv:(\d+)/)?.[1];
		const os = s.includes("Windows") ? "Windows" : s.includes("Mac OS") ? "Mac" : s.includes("Android") ? "Android" : s.includes("iPhone") || s.includes("iPad") ? "iOS" : "";
		if (edge) return `Edge ${edge}${os ? ` (${os})` : ""}`;
		if (chrome && !s.includes("Edg")) return `Chrome ${chrome}${os ? ` (${os})` : ""}`;
		if (firefox) return `Firefox ${firefox}${os ? ` (${os})` : ""}`;
		if (safari || s.includes("Safari")) return `Safari ${safari || ""}${os ? ` (${os})` : ""}`.trim();
		if (msie) return `IE ${msie}${os ? ` (${os})` : ""}`;
		return s.length > 60 ? `${s.slice(0, 57)}…` : s;
	};

	/** 디바이스 타입에 따른 아이콘 */
	const getDeviceTypeIcon = (deviceType: string) => {
		const iconMap: Record<string, string> = {
			PC: "solar:monitor-bold-duotone",
			Mobile: "solar:smartphone-bold-duotone",
			App: "solar:iphone-bold-duotone",
		};
		return iconMap[deviceType] ?? "solar:devices-bold-duotone";
	};

	/** 브라우저에 따른 아이콘 */
	const getBrowserIcon = (ua: string): string => {
		if (!ua) return "solar:global-bold-duotone";
		const s = ua.toLowerCase();
		if (s.includes("edg")) return "logos:microsoft-edge";
		if (s.includes("chrome") && !s.includes("edg")) return "logos:chrome";
		if (s.includes("firefox")) return "logos:firefox";
		if (s.includes("safari") && !s.includes("chrome")) return "logos:safari";
		return "solar:global-bold-duotone";
	};

	/** 이메일 인증 완료 이벤트의 인증 환경 블록 (브라우저/디바이스) */
	const renderEmailVerifyContext = (detail: Record<string, unknown> | null) => {
		if (!detail || typeof detail !== "object") return null;
		const deviceType = detail.deviceType as string | undefined;
		const userAgent = detail.userAgent as string | undefined;
		if (!deviceType && !userAgent) return null;
		const browserLabel = userAgent ? parseUserAgentLabel(userAgent) : "";
		const browserIcon = userAgent ? getBrowserIcon(userAgent) : "";
		return (
			<div className="mt-2 space-y-2 rounded-lg border border-gray-200/60 bg-gray-50 px-3 py-2 dark:border-gray-700/50 dark:bg-gray-800/50">
				<div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400">
					<Iconify icon="solar:devices-bold-duotone" size={16} />
					인증 환경
				</div>
				<div className="flex flex-wrap items-center gap-3">
					{deviceType && (
						<div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 shadow-sm dark:bg-gray-700">
							<Iconify icon={getDeviceTypeIcon(deviceType)} size={20} className="text-primary" />
							<span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
								{getDeviceTypeLabel(deviceType)}
							</span>
						</div>
					)}
					{browserLabel && (
						<div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 shadow-sm dark:bg-gray-700" title={userAgent}>
							<Iconify icon={browserIcon} size={18} />
							<span className="text-sm text-gray-700 dark:text-gray-300">{browserLabel}</span>
						</div>
					)}
				</div>
			</div>
		);
	};

	return (
		<Space direction="vertical" size="large" className="w-full">
			<Card>
				<Space>
					<Button onClick={() => navigate("/auth-log")}>
						<Iconify icon="solar:arrow-left-bold" size={18} className="mr-2" />
						목록으로
					</Button>
				</Space>
			</Card>

			{/* 기본 정보 */}
			<Card title="기본 정보">
				<Descriptions column={2} bordered>
					<Descriptions.Item label="요청 ID">
						<code>{authLog.id}</code>
					</Descriptions.Item>
					<Descriptions.Item label="상태">
						{getStatusTag(authLog.status)}
					</Descriptions.Item>
					<Descriptions.Item label="App">
						{authLog.app?.name || "-"}
					</Descriptions.Item>
					<Descriptions.Item label="사용자">
						<code>{authLog.user?.email ?? authLog.user?.name ?? "-"}</code>
					</Descriptions.Item>
					<Descriptions.Item label="국가">
						{authLog.country ? <Tag>{authLog.country}</Tag> : "-"}
					</Descriptions.Item>
					<Descriptions.Item label="IP 주소">
						<code>{authLog.requestIp || "-"}</code>
					</Descriptions.Item>
					<Descriptions.Item label="디바이스 / 인증 수단">
						{authLog.approvedDevice ? (
							<Space size="small">
								<Tag color={authLog.approvedDevice.platform === "ios" ? "blue" : "green"}>
									{authLog.approvedDevice.platform?.toUpperCase() ?? "-"}
								</Tag>
								<span>{authLog.approvedDevice.deviceName || "-"}</span>
							</Space>
						) : authLog.status === "APPROVED" && authLog.timeline?.some((e) => e.eventType === "APPROVED_BY_EMAIL") ? (() => {
							const emailEvent = authLog.timeline?.find((e) => e.eventType === "APPROVED_BY_EMAIL");
							const detail = emailEvent?.detail && typeof emailEvent.detail === "object" ? emailEvent.detail as Record<string, unknown> : null;
							const deviceType = detail?.deviceType as string | undefined;
							const userAgent = detail?.userAgent as string | undefined;
							const browserLabel = userAgent ? parseUserAgentLabel(userAgent) : "";
							return (
								<Space size="small" wrap>
									{/* 디바이스 타입 먼저 */}
									{deviceType && (
										<Space size={4}>
											<Iconify icon={getDeviceTypeIcon(deviceType)} size={16} className="text-gray-600" />
											<Tag color={deviceType === "PC" ? "blue" : deviceType === "Mobile" ? "geekblue" : "green"}>
												{getDeviceTypeLabel(deviceType)}
											</Tag>
										</Space>
									)}
									{/* 인증 수단 */}
									<Tag color="cyan">이메일 인증</Tag>
									{/* 브라우저 정보 */}
									{browserLabel && (
										<Space size={4}>
											<Iconify icon={getBrowserIcon(userAgent || "")} size={14} />
											<span className="text-sm text-gray-600 dark:text-gray-400" title={userAgent}>
												{browserLabel}
											</span>
										</Space>
									)}
								</Space>
							);
						})() : (
							"-"
						)}
					</Descriptions.Item>
					<Descriptions.Item label="요청 시간">
						{dayjs(authLog.createdAt).format("YYYY-MM-DD HH:mm:ss")}
					</Descriptions.Item>
					{authLog.expiresAt && (
						<Descriptions.Item label="만료 시간">
							{dayjs(authLog.expiresAt).format("YYYY-MM-DD HH:mm:ss")}
						</Descriptions.Item>
					)}
				</Descriptions>
			</Card>

			{/* 정책 차단 여부 */}
			{authLog.blockedByPolicy && (
				<Alert
					message="정책에 의해 차단됨"
					description="이 인증 요청은 보안 정책에 의해 자동으로 차단되었습니다."
					type="warning"
					showIcon
				/>
			)}

			{/* 위험 이벤트 */}
			{authLog.riskEvents && authLog.riskEvents.length > 0 && (
				<Card title="위험 감지">
					<Space direction="vertical" className="w-full">
						{authLog.riskEvents.map((risk) => (
							<Alert
								key={risk.id}
								message={risk.riskType}
								description={
									<Space>
										{risk.score && <span>점수: {risk.score}</span>}
										{risk.action && <Tag>{risk.action}</Tag>}
										<span className="text-gray-500">
											{dayjs(risk.createdAt).format("YYYY-MM-DD HH:mm:ss")}
										</span>
									</Space>
								}
								type="warning"
								showIcon
							/>
						))}
					</Space>
				</Card>
			)}

			{/* 승인 디바이스 */}
			{authLog.approvedDevice && (
				<Card title="승인 디바이스">
					<Descriptions column={2} bordered>
						<Descriptions.Item label="플랫폼">
							<Tag color={authLog.approvedDevice.platform === 'ios' ? 'blue' : 'green'}>
								{authLog.approvedDevice.platform.toUpperCase()}
							</Tag>
						</Descriptions.Item>
						<Descriptions.Item label="디바이스 이름">
							{authLog.approvedDevice.deviceName || "-"}
						</Descriptions.Item>
						<Descriptions.Item label="생체 인증 지원">
							{authLog.approvedDevice.biometricCapable ? "예" : "아니오"}
						</Descriptions.Item>
					</Descriptions>
				</Card>
			)}

			{/* 타임라인 (세로 좌우 교차 스타일) */}
			<Card
				title={
					<span className="flex items-center gap-2">
						<Iconify icon="solar:history-bold-duotone" className="text-primary" />
						요청 → 승인까지 타임라인
					</span>
				}
				className="overflow-hidden"
			>
				{authLog.timeline && authLog.timeline.length > 0 ? (() => {
					const events = authLog.timeline;
					const startTs = typeof events[0]?.createdAt === "number" ? events[0].createdAt : Number(events[0]?.createdAt ?? 0);
					const endTs = typeof events[events.length - 1]?.createdAt === "number" ? events[events.length - 1].createdAt : Number(events[events.length - 1]?.createdAt ?? startTs);
					const totalMs = Math.max(1, endTs - startTs);
					const formatDuration = (ms: number) => {
						if (ms < 1000) return `${ms}ms`;
						const s = Math.floor(ms / 1000);
						const m = Math.floor(s / 60);
						if (m > 0) return `${m}분 ${s % 60}초`;
						return `${s}초`;
					};
					type EventWithMeta = { id: string; eventType: string; detail: unknown; createdAt: number; ts: number; durationFromPrev: number };
					const eventsWithMeta: EventWithMeta[] = events.map((ev, i) => {
						const ts = typeof ev.createdAt === "number" ? ev.createdAt : Number(ev.createdAt);
						const prevTs = i > 0 ? (typeof events[i - 1].createdAt === "number" ? events[i - 1].createdAt : Number(events[i - 1].createdAt)) : ts;
						const durationFromPrev = Math.max(0, ts - prevTs);
						return { ...ev, ts, durationFromPrev: i > 0 ? durationFromPrev : 0 };
					});
					return (
					<div className="space-y-6">
						{/* 인증까지 소요 시간 */}
						<div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/15 to-primary/5 px-8 py-5 shadow-sm dark:border-primary/40">
							<div className="flex items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
									<Iconify icon="solar:clock-circle-bold-duotone" className="text-primary" size={28} />
								</div>
								<span className="text-base font-semibold text-gray-700 dark:text-gray-300">총 소요 시간</span>
							</div>
							<span className="text-3xl font-bold text-primary">{formatDuration(totalMs > 1 ? totalMs : 0)}</span>
						</div>

						{/* 세로 타임라인 (좌우 교차) */}
						<div className="relative mx-auto max-w-3xl px-4">
							{/* 전체 세로 연결선 (z-0으로 맨 뒤에 배치) */}
							<div
								className="absolute left-1/2 z-0 w-1 -translate-x-1/2 bg-gradient-to-b from-primary via-gray-300 to-green-500 dark:via-gray-600"
								style={{ top: 34, bottom: 60 }}
								aria-hidden
							/>

							{eventsWithMeta.map((event, index): React.ReactElement => {
								const nodeStyle = getEventNodeStyle(String(event.eventType));
								const isLeft = index % 2 === 0;
								const isFirst = index === 0;
								const isLast = index === events.length - 1;
								const detail = event.detail && typeof event.detail === "object" ? event.detail as Record<string, unknown> : null;
								const isEmailApproved = event.eventType === "APPROVED_BY_EMAIL";
								const isEmailCodeSent = event.eventType === "EMAIL_CODE_SENT";
								const hasEmailContext = !!(isEmailApproved && detail && (detail.deviceType || detail.userAgent));
								const hasEmailSentInfo = !!(isEmailCodeSent && detail && detail.email);
								return (
								<div
									key={event.id}
									className={`relative flex items-start ${isLeft ? "flex-row" : "flex-row-reverse"}`}
									style={{ minHeight: 140, paddingTop: 16, paddingBottom: 16 }}
								>
									{/* 이벤트 카드 */}
									<div className={`w-[calc(50%-40px)] min-w-[200px] ${isLeft ? "pr-4 text-right" : "pl-4 text-left"}`}>
										<div
											className={`rounded-2xl border-2 p-5 shadow-md transition-all hover:shadow-lg ${
												isLast 
													? "animate-pulse border-primary bg-primary/5 ring-2 ring-primary/30 dark:bg-primary/10" 
													: isFirst 
														? "border-primary/50 bg-white dark:bg-gray-800" 
														: "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
											}`}
											style={isLast ? { animationDuration: "2s" } : undefined}
										>
											{/* 현재 단계 배지 */}
											{isLast && (
												<div className={`mb-2 ${isLeft ? "text-right" : "text-left"}`}>
													<span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
														<span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
														현재 단계
													</span>
												</div>
											)}
											{/* 이벤트 제목 + 아이콘 */}
											<div className={`mb-3 flex items-center gap-3 ${isLeft ? "flex-row-reverse" : ""}`}>
												<div
													className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-md ${isLast ? "ring-2 ring-primary/50" : ""}`}
													style={{ backgroundColor: nodeStyle.bg, border: `3px solid ${nodeStyle.border}` }}
												>
													<Iconify icon={getEventIcon(event.eventType)} size={26} style={{ color: nodeStyle.icon }} />
												</div>
												<span className="text-lg font-bold text-gray-800 dark:text-gray-100">
													{getEventLabel(event.eventType)}
												</span>
											</div>
											{/* 구간 소요 시간 */}
											{(index > 0 ? (
												<div className={`mb-2 text-sm font-medium text-primary ${isLeft ? "text-right" : "text-left"}`}>
													+{formatDuration(Number(event.durationFromPrev))} 경과
												</div>
											) : null) as React.ReactNode}
											{/* 이메일 코드 전송 정보 */}
											{hasEmailSentInfo && (
												<div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-left dark:border-cyan-800 dark:bg-cyan-900/30">
													<div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-400">
														<Iconify icon="solar:letter-bold-duotone" size={16} />
														<span>발송 정보</span>
													</div>
													<div className="space-y-1.5">
														<div className="flex items-center gap-2">
															<Iconify icon="solar:mailbox-bold-duotone" size={14} className="shrink-0 text-cyan-600" />
															<span className="shrink-0 text-xs text-gray-500">이메일</span>
														</div>
														<code className="block truncate text-sm font-semibold text-gray-700 dark:text-gray-300" title={String(detail.email)}>
															{String(detail.email)}
														</code>
														{detail.code != null && detail.code !== "" && (
															<>
																<div className="mt-2 flex items-center gap-2">
																	<Iconify icon="solar:lock-password-bold-duotone" size={14} className="shrink-0 text-cyan-600" />
																	<span className="shrink-0 text-xs text-gray-500">인증코드</span>
																</div>
																<code className="inline-block rounded bg-cyan-100 px-2 py-0.5 text-sm font-bold tracking-widest text-cyan-800 dark:bg-cyan-800 dark:text-cyan-200">
																	{String(detail.code)}
																</code>
															</>
														)}
													</div>
												</div>
											)}
											{/* 이메일 인증 환경 */}
											{hasEmailContext && (
												<div className={`mt-3 ${isLeft ? "text-left" : "text-left"}`}>
													{renderEmailVerifyContext(detail)}
												</div>
											)}
										</div>
									</div>

									{/* 가운데 시간 노드 */}
									<div className="relative flex w-24 items-center justify-center" style={{ minHeight: 90, zIndex: 5 }}>
										{/* 세로선 차단용 배경 (z-index: 1) */}
										<div 
											className="absolute inset-0 flex items-center justify-center"
											style={{ zIndex: 1 }}
											aria-hidden
										>
											<div 
												className="rounded-full" 
												style={{ 
													width: 96, 
													height: 96, 
													backgroundColor: "white",
												}} 
											/>
										</div>
										{/* 시간 뱃지 (z-index: 2) */}
										{(() => {
											// 마지막 노드의 색상은 인증 상태에 따라 결정
											const lastBorderColor = authLog.status === "APPROVED" ? "border-green-500" 
												: authLog.status === "PENDING" ? "border-blue-500" 
												: authLog.status === "EXPIRED" ? "border-gray-400" 
												: authLog.status === "DENIED" ? "border-red-500" 
												: "border-gray-400";
											const lastTextColor = authLog.status === "APPROVED" ? "text-green-600" 
												: authLog.status === "PENDING" ? "text-blue-600" 
												: authLog.status === "EXPIRED" ? "text-gray-500" 
												: authLog.status === "DENIED" ? "text-red-600" 
												: "text-gray-500";
											const lastSubTextColor = authLog.status === "APPROVED" ? "text-green-500" 
												: authLog.status === "PENDING" ? "text-blue-500" 
												: authLog.status === "EXPIRED" ? "text-gray-400" 
												: authLog.status === "DENIED" ? "text-red-500" 
												: "text-gray-400";
											return (
												<div
													className={`flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-4 bg-white shadow-lg dark:bg-gray-900 ${
														isFirst ? "border-primary" : isLast ? lastBorderColor : "border-gray-300 dark:border-gray-600"
													}`}
													style={{ position: "relative", zIndex: 2 }}
												>
													<span className={`text-base font-bold leading-tight ${isFirst ? "text-primary" : isLast ? lastTextColor : "text-gray-700 dark:text-gray-300"}`}>
														{dayjs(event.ts).format("HH:mm")}
													</span>
													<span className={`text-xs font-medium ${isFirst ? "text-primary/70" : isLast ? lastSubTextColor : "text-gray-400 dark:text-gray-500"}`}>
														:{dayjs(event.ts).format("ss")}
													</span>
												</div>
											);
										})()}
									</div>

									{/* 반대쪽 빈 공간 */}
									<div className="w-[calc(50%-40px)]" />
								</div>
								) as React.ReactElement;
							})}

							{/* 상태 표시 */}
							<div className="relative flex justify-center pt-6">
								{authLog.status === "APPROVED" ? (
									<div className="flex items-center gap-2 rounded-full border-2 border-green-500 bg-green-50 px-6 py-2.5 shadow-md dark:bg-green-900/30">
										<Iconify icon="solar:check-circle-bold" className="text-green-600" size={22} />
										<span className="text-base font-bold text-green-700 dark:text-green-400">인증 완료</span>
									</div>
								) : authLog.status === "PENDING" ? (
									<div className="flex items-center gap-2 rounded-full border-2 border-blue-500 bg-blue-50 px-6 py-2.5 shadow-md dark:bg-blue-900/30">
										<Iconify icon="solar:clock-circle-bold-duotone" className="text-blue-600" size={22} />
										<span className="text-base font-bold text-blue-700 dark:text-blue-400">인증 진행중</span>
									</div>
								) : authLog.status === "EXPIRED" ? (
									<div className="flex items-center gap-2 rounded-full border-2 border-gray-400 bg-gray-100 px-6 py-2.5 shadow-md dark:border-gray-500 dark:bg-gray-800/50">
										<Iconify icon="solar:clock-circle-bold" className="text-gray-500" size={22} />
										<span className="text-base font-bold text-gray-600 dark:text-gray-400">시간 만료</span>
									</div>
								) : authLog.status === "DENIED" ? (
									<div className="flex items-center gap-2 rounded-full border-2 border-red-500 bg-red-50 px-6 py-2.5 shadow-md dark:bg-red-900/30">
										<Iconify icon="solar:close-circle-bold" className="text-red-600" size={22} />
										<span className="text-base font-bold text-red-700 dark:text-red-400">인증 거부</span>
									</div>
								) : (
									<div className="flex items-center gap-2 rounded-full border-2 border-gray-400 bg-gray-100 px-6 py-2.5 shadow-md dark:border-gray-500 dark:bg-gray-800/50">
										<Iconify icon="solar:question-circle-bold" className="text-gray-500" size={22} />
										<span className="text-base font-bold text-gray-600 dark:text-gray-400">{authLog.status}</span>
									</div>
								)}
							</div>
						</div>
					</div>
					);
				})() : (
					<div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-12 text-center text-gray-500 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
						이벤트가 없습니다.
					</div>
				)}
			</Card>
		</Space>
	);
}

