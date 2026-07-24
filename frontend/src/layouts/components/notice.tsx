import { Badge, Button, Drawer, Tag, Spin, Empty } from "antd";
import { type CSSProperties, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import CyanBlur from "@/assets/images/background/cyan-blur.png";
import RedBlur from "@/assets/images/background/red-blur.png";
import { IconButton, Iconify, SvgIcon } from "@/components/icon";
import { themeVars } from "@/theme/theme.css";
import logService from "@/api/services/log";
import type { LogAlarm } from "@/types/entity";

const { VITE_APP_TITLE } = import.meta.env;
dayjs.extend(relativeTime);

export default function NoticeButton() {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data, isLoading, dataUpdatedAt } = useQuery({
		queryKey: ["notifications"],
		queryFn: () => logService.getAlarmList({ option: { offset: 0, limit: 20 } }),
		refetchInterval: 60000,
	});

	const notifications = data?.data ?? [];
	const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

	const [activeMarkId, setActiveMarkId] = useState<number | null>(null);

	const markOneMutation = useMutation({
		mutationFn: async (alarm: LogAlarm) =>
			logService.updateAlarm({
				id: alarm.id,
				is_read: true,
				read_at: new Date().toISOString(),
			}),
		onMutate: (alarm) => {
			setActiveMarkId(alarm.id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
		onSettled: () => {
			setActiveMarkId(null);
		},
	});

	const [markAllLoading, setMarkAllLoading] = useState(false);

	const handleOpenAction = (url?: string | null) => {
		if (!url) return;
		const trimmed = url.trim();
		if (!trimmed) return;

		if (trimmed.startsWith("/")) {
			setDrawerOpen(false);
			navigate(trimmed);
			return;
		}

		try {
			const parsed = new URL(trimmed, window.location.origin);
			if (parsed.origin === window.location.origin) {
				setDrawerOpen(false);
				navigate(parsed.pathname + parsed.search + parsed.hash);
			} else {
				window.open(parsed.href, "_blank", "noopener,noreferrer");
			}
		} catch {
			const fallback = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
			window.open(fallback, "_blank", "noopener,noreferrer");
		}
	};

	const handleMarkAllRead = async () => {
		const unread = notifications.filter((item) => !item.is_read);
		if (!unread.length) {
			setDrawerOpen(false);
			return;
		}
		setMarkAllLoading(true);
		try {
			await Promise.all(
				unread.map((item) =>
					logService.updateAlarm({
						id: item.id,
						is_read: true,
						read_at: new Date().toISOString(),
					}),
				),
			);
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		} finally {
			setMarkAllLoading(false);
			setDrawerOpen(false);
		}
	};

	const style: CSSProperties = {
		backdropFilter: "blur(20px)",
		backgroundImage: `url("${CyanBlur}"), url("${RedBlur}")`,
		backgroundRepeat: "no-repeat, no-repeat",
		backgroundColor: `rgba(${themeVars.colors.background.paperChannel} / 0.9)`,
		backgroundPosition: "right top, left bottom",
		backgroundSize: "50, 50%",
	};

	const viewAllLabel = t("sys.menu.notice.view_all", { defaultValue: "View All" });
	const emptyDescription = t("sys.menu.notice.no_notifications", { defaultValue: "새 알림이 없습니다" });
	const markReadLabel = t("sys.menu.notice.mark_as_read", { defaultValue: "읽음 처리" });
	const openLabel = t("common.open", { defaultValue: "열기" });

	return (
		<div>
			<IconButton onClick={() => setDrawerOpen(true)}>
				<Badge
					count={unreadCount}
					styles={{
						root: { color: "inherit" },
						indicator: { color: themeVars.colors.common.white },
					}}
				>
					<Iconify icon="solar:bell-bing-bold-duotone" size={24} />
				</Badge>
			</IconButton>
			<Drawer
				placement="right"
				title={
					<div className="flex flex-col">
						<span>Notifications</span>
						{dataUpdatedAt && (
							<span className="text-xs text-gray-500 font-normal mt-1">
								{t("sys.menu.notice.last_refresh", { defaultValue: "마지막 새로고침" })}: {new Date(dataUpdatedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
							</span>
						)}
					</div>
				}
				onClose={() => setDrawerOpen(false)}
				open={drawerOpen}
				closable={false}
				width={420}
				styles={{
					body: { padding: 0 },
					mask: { backgroundColor: "transparent" },
				}}
				style={style}
				extra={
					<IconButton
						style={{ color: themeVars.colors.palette.primary.default }}
						onClick={handleMarkAllRead}
						disabled={!unreadCount || markAllLoading}
					>
						<Iconify icon="solar:check-read-broken" size={20} />
					</IconButton>
				}
				footer={
					<div
						style={{ color: themeVars.colors.text.primary }}
						className="flex h-10 w-full items-center justify-center font-semibold"
					>
						<Button
							type="link"
							onClick={() => {
								setDrawerOpen(false);
								navigate("/management/account?tab=3");
							}}
						>
							{viewAllLabel}
						</Button>
					</div>
				}
			>
				<NoticeTab
					isLoading={isLoading}
					notifications={notifications}
					onMarkRead={(alarm) => {
						if (alarm.is_read) return;
						markOneMutation.mutate(alarm);
					}}
					actionLoadingId={activeMarkId}
					isMutating={markOneMutation.isPending}
					onOpenAction={handleOpenAction}
					applicationName={VITE_APP_TITLE}
					emptyDescription={emptyDescription}
					markReadLabel={markReadLabel}
					openLabel={openLabel}
				/>
			</Drawer>
		</div>
	);
}

interface NoticeTabProps {
	isLoading: boolean;
	notifications: LogAlarm[];
	onMarkRead: (alarm: LogAlarm) => void;
	applicationName: string;
	actionLoadingId: number | null;
	isMutating: boolean;
	onOpenAction: (url?: string | null) => void;
	emptyDescription: string;
	markReadLabel: string;
	openLabel: string;
}

// 알림 내용에서 링크를 감지하고 클릭 가능하게 만드는 함수
function renderContentWithLinks(content: string, t?: (key: string, options?: { defaultValue?: string }) => string) {
	if (!content) return content;
	
	const linkHint = t?.("sys.menu.notice.link_click_to_open", { defaultValue: "클릭하여 새 창에서 열기" }) || "클릭하여 새 창에서 열기";
	
	// http:// 또는 https://로 시작하는 링크를 찾는 정규식 (http와 https 모두 매칭)
	const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
	const matches = content.match(urlRegex);
	
	// 링크가 없으면 원본 텍스트 반환
	if (!matches || matches.length === 0) {
		return <span>{content}</span>;
	}
	
	// 링크를 찾아서 교체
	const parts: (string | JSX.Element)[] = [];
	let lastIndex = 0;
	
	matches.forEach((url, index) => {
		const urlIndex = content.indexOf(url, lastIndex);
		
		// 링크 앞의 텍스트 추가
		if (urlIndex > lastIndex) {
			parts.push(<span key={`text-${index}`}>{content.substring(lastIndex, urlIndex)}</span>);
		}
		
		// 링크 추가
		parts.push(
			<span key={`link-${index}`} className="inline-flex items-center gap-1 flex-wrap">
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
					className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
					title={linkHint}
				>
					<Iconify icon="mdi:link" size={14} />
					{url}
				</a>
				<span className="text-xs text-gray-500 ml-1">({linkHint})</span>
			</span>
		);
		
		lastIndex = urlIndex + url.length;
	});
	
	// 마지막 링크 뒤의 텍스트 추가
	if (lastIndex < content.length) {
		parts.push(<span key="text-end">{content.substring(lastIndex)}</span>);
	}
	
	return <>{parts}</>;
}

function NoticeTab({
	isLoading,
	notifications,
	onMarkRead,
	applicationName,
	actionLoadingId,
	onOpenAction,
	isMutating,
	emptyDescription,
	markReadLabel,
	openLabel,
}: NoticeTabProps) {
	const { t } = useTranslation();
	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spin />
			</div>
		);
	}

	if (!notifications.length) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Empty description={emptyDescription} />
			</div>
		);
	}

	const priorityColor: Record<string, string> = {
		high: "error",
		medium: "warning",
		low: "processing",
	};

	return (
		<div className="flex flex-col gap-4 px-6 py-4">
			{notifications.map((item) => (
				<div
					key={item.id}
					className={`rounded-2xl border p-4 shadow-sm ${item.is_read ? "border-gray-100 bg-white" : "border-blue-200 bg-blue-50"}`}
				>
					<div className="flex flex-wrap items-center gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<SvgIcon icon="ic_mail" size={20} />
							<Tag color={priorityColor[item.priority || "low"] || "default"}>
								{(item.priority || "low").toUpperCase()}
							</Tag>
						</div>
						<div className="text-xs text-gray-500 ml-auto whitespace-nowrap">
							{item.created_at ? dayjs(item.created_at).fromNow() : ""}
						</div>
					</div>
					<div className="mt-2 font-semibold">{item.title || applicationName}</div>
					<div className="mt-1 text-sm text-gray-700">
						{renderContentWithLinks(item.content, t)}
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-2">
					{item.action_url && (
							<Button
								size="small"
							onClick={() => onOpenAction(item.action_url)}
							>
							{item.action_text || openLabel}
							</Button>
						)}
						{!item.is_read && (
						<Button
							size="small"
							type="primary"
							onClick={() => onMarkRead(item)}
							loading={actionLoadingId === item.id && isMutating}
						>
							{markReadLabel}
							</Button>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
