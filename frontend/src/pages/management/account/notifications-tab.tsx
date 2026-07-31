import Card from "@/components/card";
import { Timeline, Typography, DatePicker, Row, Col, Space, Tag, Spin, Button, message } from "antd";
import { useEffect, useState, useRef, useCallback, type ReactElement } from "react";
import { themeVars } from "@/theme/theme.css";
import dayjs, { Dayjs } from "dayjs";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Iconify } from "@/components/icon";
import logService from "@/api/services/log";
import type { LogAlarm } from "@/types/entity";

const { RangePicker } = DatePicker;
const PAGE_SIZE = 10;
// 7일 전 ~ 오늘
const defaultStart = dayjs().subtract(7, 'day').startOf('day');
const defaultEnd = dayjs().endOf('day');

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
	const parts: (string | ReactElement)[] = [];
	let lastIndex = 0;
	
	matches.forEach((url, index) => {
		const urlIndex = content.indexOf(url, lastIndex);
		
		// 링크 앞의 텍스트 추가
		if (urlIndex > lastIndex) {
			parts.push(<span key={`text-${index}`}>{content.substring(lastIndex, urlIndex)}</span>);
		}
		
		// 링크 추가
		parts.push(
			<span key={`link-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
					style={{ color: '#1890ff', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
					title={linkHint}
				>
					<Iconify icon="mdi:link" size={14} />
					{url}
				</a>
				<span style={{ fontSize: '11px', color: '#999', marginLeft: '4px' }}>({linkHint})</span>
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

export default function NotificationsTab() {
	const { t } = useTranslation();
	const [range, setRange] = useState<[Dayjs | null, Dayjs | null]>([defaultStart, defaultEnd]);
	const observerRef = useRef<IntersectionObserver | null>(null);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();
	const [markingId, setMarkingId] = useState<number | null>(null);
	const [markAllLoading, setMarkAllLoading] = useState(false);

	// 알림 데이터 무한 스크롤 조회
	const {
		data: alarmData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
	} = useInfiniteQuery({
		queryKey: ["alarms", range],
		queryFn: ({ pageParam = 0 }) => logService.getAlarmList({
			is_read: undefined,
			type: undefined,
			priority: undefined,
			option: {
				offset: pageParam * PAGE_SIZE,
				limit: PAGE_SIZE,
				created_sd_at: range[0]?.format("YYYY-MM-DD HH:mm:ss"),
				created_ed_at: range[1]?.format("YYYY-MM-DD HH:mm:ss"),
			}
		}),
		getNextPageParam: (lastPage, allPages) => {
			const total = Number(lastPage?.pagination?.total ?? 0);
			if (total === 0) return undefined;
			return total > allPages.length * PAGE_SIZE ? allPages.length : undefined;
		},
		initialPageParam: 0,
	});

	// IntersectionObserver 설정
	const handleObserver = useCallback(
		(entries: IntersectionObserverEntry[]) => {
			const [target] = entries;
			if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
				fetchNextPage();
			}
		},
		[fetchNextPage, hasNextPage, isFetchingNextPage]
	);

	useEffect(() => {
		const element = loadMoreRef.current;
		if (!element) return;

		observerRef.current = new IntersectionObserver(handleObserver, {
			root: null,
			rootMargin: "20px",
			threshold: 0.1,
		});

		observerRef.current.observe(element);

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, [handleObserver]);

	// 알림 타입별 색상 매핑
	const getTypeColor = (type: LogAlarm['type']) => {
		const colors: Record<LogAlarm['type'], string> = {
			system: themeVars.colors.palette.info.default,
			payment: themeVars.colors.palette.error.default,
			security: themeVars.colors.palette.warning.default,
			usage: themeVars.colors.palette.success.default,
			maintenance: themeVars.colors.palette.warning.default,
			custom: themeVars.colors.palette.info.default,
		};
		return colors[type];
	};

	// 알림 우선순위별 태그 매핑
	const getPriorityTag = (priority: LogAlarm['priority']) => {
		const tags: Record<LogAlarm['priority'], { color: string; text: string }> = {
			low: { color: "default", text: "낮음" },
			medium: { color: "processing", text: "중간" },
			high: { color: "warning", text: "높음" },
			urgent: { color: "error", text: "긴급" },
		};
		const { color, text } = tags[priority];
		return <Tag color={color}>{text}</Tag>;
	};

	// 우선순위에 따른 위치 결정
	const getPosition = (priority: LogAlarm['priority']) => {
		const positions: Record<LogAlarm['priority'], 'left' | 'right'> = {
			low: 'left',
			medium: 'left',
			high: 'right',
			urgent: 'right',
		};
		return positions[priority];
	};

	// 모든 페이지의 알림 데이터를 하나의 배열로 병합
	const allAlarms = alarmData?.pages?.flatMap((page) => page?.data ?? []) ?? [];
	const total = Number(alarmData?.pages?.[0]?.pagination?.total ?? 0);
	const unreadCount = allAlarms.filter((item) => !item.is_read).length;

	const handleMarkOne = async (alarm: LogAlarm) => {
		if (alarm.is_read) return;
		setMarkingId(alarm.id);
		try {
			await logService.updateAlarm({
				id: alarm.id,
				is_read: true,
				read_at: dayjs().toISOString(),
			});
			message.success("읽음 처리했습니다.");
			queryClient.invalidateQueries({ queryKey: ["alarms"] });
		} catch (error) {
			message.error("읽음 처리에 실패했습니다.");
		} finally {
			setMarkingId(null);
		}
	};

	const handleMarkAll = async () => {
		if (!unreadCount) return;
		setMarkAllLoading(true);
		const unreadIds = allAlarms.filter((item) => !item.is_read).map((item) => item.id);
		try {
			await Promise.all(
				unreadIds.map((id) =>
					logService.updateAlarm({
						id,
						is_read: true,
						read_at: dayjs().toISOString(),
					}),
				),
			);
			message.success("전체 읽음 처리했습니다.");
			queryClient.invalidateQueries({ queryKey: ["alarms"] });
		} catch (error) {
			message.error("전체 읽음 처리에 실패했습니다.");
		} finally {
			setMarkAllLoading(false);
		}
	};

	return (
		<Card className="!h-auto flex-col w-full">
			<Row gutter={[16, 16]} align="middle" className="mb-6 w-full">
				<Col span={24} md={16} className="flex flex-wrap items-center gap-3">
					<Typography.Title level={4} className="mb-0">알림 타임라인</Typography.Title>
					<Typography.Text type="secondary" className="ml-2">
						총 <b>{total}</b>개 / 표시 <b>{allAlarms.length > total ? total : allAlarms.length}</b>개
					</Typography.Text>
					<Button
						type="default"
						className="ml-4 mt-2 md:mt-0"
						onClick={handleMarkAll}
						disabled={!unreadCount}
						loading={markAllLoading}
					>
						전체 읽음 처리
					</Button>
				</Col>
				<Col span={24} md={8} className="flex justify-end gap-3 flex-wrap">
					<RangePicker
						value={range}
						onChange={(dates) => setRange(dates as [Dayjs | null, Dayjs | null])}
						allowClear
						style={{ minWidth: 260 }}
						format="YYYY-MM-DD"
					/>
				</Col>
			</Row>
			<Row gutter={[16, 16]} align="middle" className="mb-6 w-full">
				<Col span={24} className="flex items-center gap-4">
					<Spin spinning={isLoading} className="w-full">
						<Timeline
							className="!mt-4 w-full"
							items={allAlarms.map((item: LogAlarm) => ({
								color: getTypeColor(item.type),
								position: getPosition(item.priority),
								children: (
									<div className="flex flex-col">
										<div className="flex items-center justify-between">
											<Space>
												<Typography.Text strong>{item.title}</Typography.Text>
												{getPriorityTag(item.priority)}
												{item.is_read ? (
													<Tag color="success">읽음</Tag>
												) : (
													<Tag color="warning">안읽음</Tag>
												)}
											</Space>
											<div className="flex items-center gap-2">
												<div className="opacity-50 whitespace-nowrap">
													{dayjs(item.created_at).format("YYYY-MM-DD HH:mm")}
												</div>
												{!item.is_read && (
													<Button
														size="small"
														type="link"
														onClick={() => handleMarkOne(item)}
														loading={markingId === item.id}
													>
														읽음 처리
													</Button>
												)}
											</div>
										</div>
										{item.content && (
											<Typography.Text type="secondary" className="text-xs mt-1">
												{renderContentWithLinks(item.content, t)}
											</Typography.Text>
										)}
									</div>
								),
							}))}
						/>
						{allAlarms.length === 0 && !isLoading && (
							<div className="w-full flex flex-col items-center justify-center py-12">
								<Typography.Text type="secondary">
									데이터가 없습니다. 날짜를 바꿔서 조회해보세요.
								</Typography.Text>
							</div>
						)}
						{hasNextPage && (
							<div 
								ref={loadMoreRef} 
								className="h-10 flex items-center justify-center cursor-pointer"
								onClick={() => fetchNextPage()}
							>
								{isFetchingNextPage ? (
									<Spin size="small" />
								) : (
									<Typography.Text type="secondary">
										더 보기
									</Typography.Text>
								)}
							</div>
						)}
					</Spin>		
				</Col>
			</Row>
			
		</Card>
	);
}
