import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReactFlow, type Node, type Edge, Handle, Position, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Table } from "antd";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const GAP_X = 48;
const GAP_Y = 64;

/** 분기 레이아웃: 왼쪽=모바일, 가운데=진입/합류/공통, 오른쪽=이메일 */
const LAYOUT = {
	/** 모바일 연동 열 (왼쪽) */
	COL_LEFT: 0,
	/** 진입·합류·공통 열 (가운데) */
	COL_CENTER: NODE_WIDTH + GAP_X,
	/** 이메일 연동 열 (오른쪽) */
	COL_RIGHT: (NODE_WIDTH + GAP_X) * 2,
	/** 세로 행: 0=진입, 1=분기, 2~3=이메일전용, 4=합류, 5~7=공통 */
	row: (i: number) => i * (NODE_HEIGHT + GAP_Y),
	/** 캔버스 최소 가로 (세 열 + 여백) */
	MIN_WIDTH: (NODE_WIDTH + GAP_X) * 2 + NODE_WIDTH + GAP_X,
} as const;

const STEP_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
	step1: { bg: "linear-gradient(145deg, #e6f7ff 0%, #bae7ff 100%)", border: "#91d5ff", badge: "#1890ff" },
	step1alt: { bg: "linear-gradient(145deg, #f6ffed 0%, #d9f7be 100%)", border: "#b7eb8f", badge: "#52c41a" },
	step1mobile: { bg: "linear-gradient(145deg, #e6f7ff 0%, #bae7ff 100%)", border: "#91d5ff", badge: "#1890ff" },
	stepAuthStatus: { bg: "linear-gradient(145deg, #e6f7ff 0%, #bae7ff 100%)", border: "#91d5ff", badge: "#1890ff" },
	stepNotifyResend: { bg: "linear-gradient(145deg, #e6f7ff 0%, #bae7ff 100%)", border: "#91d5ff", badge: "#1890ff" },
	stepResendEmail: { bg: "linear-gradient(145deg, #f6ffed 0%, #d9f7be 100%)", border: "#b7eb8f", badge: "#52c41a" },
	default: { bg: "linear-gradient(145deg, #fafafa 0%, #f5f5f5 100%)", border: "#e0e0e0", badge: "#8c8c8c" },
};

export type AuthFlowPathType = "mobile" | "email" | "common";

export interface AuthFlowStep {
	id: string;
	label: string;
	pathType?: AuthFlowPathType;
	params: { key: string; name: string; required: boolean; desc: string }[];
}

interface AuthFlowDiagramProps {
	steps: AuthFlowStep[];
	columns: import("antd").TableProps["columns"];
}

const PATH_TYPE_LABEL: Record<AuthFlowPathType, string> = {
	mobile: "sys.page.authFlow.pathType.mobile",
	email: "sys.page.authFlow.pathType.email",
	common: "sys.page.authFlow.pathType.common",
};

function FlowNode({
	data,
	selected,
}: {
	data: { label: string; stepId: string; pathType?: AuthFlowPathType };
	selected?: boolean;
}) {
	const { t } = useTranslation();
	const colors = STEP_COLORS[data.stepId] ?? STEP_COLORS.default;
	const stepNum =
		data.stepId === "step1"
			? "1"
			: data.stepId === "step1alt"
				? "1'"
				: data.stepId === "step1mobile"
					? "M"
					: data.stepId === "stepAuthStatus"
						? "P"
						: data.stepId === "stepNotifyResend"
							? "R"
							: data.stepId === "stepResendEmail"
								? "E"
								: data.stepId.replace("step", "");
	const pathType = data.pathType ?? "common";
	const pathLabel = t(PATH_TYPE_LABEL[pathType]);
	return (
		<>
			<Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
			<div
				style={{
					padding: "14px 18px",
					borderRadius: 14,
					border: selected ? "2px solid #1890ff" : `1px solid ${colors.border}`,
					background: selected ? "linear-gradient(145deg, #e6f4ff 0%, #bae7ff 100%)" : colors.bg,
					minWidth: NODE_WIDTH,
					minHeight: NODE_HEIGHT,
					display: "flex",
					flexDirection: "column",
					gap: 8,
					cursor: "pointer",
					boxShadow: selected
						? "0 6px 16px rgba(24,144,255,0.22), 0 0 0 1px rgba(24,144,255,0.1)"
						: "0 2px 10px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
					transition: "box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
				}}
				onMouseEnter={(e) => {
					if (!selected) {
						e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.04)";
						e.currentTarget.style.transform = "translateY(-2px)";
					}
				}}
				onMouseLeave={(e) => {
					if (!selected) {
						e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";
						e.currentTarget.style.transform = "translateY(0)";
					}
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span
						style={{
							width: 32,
							height: 32,
							borderRadius: "50%",
							background: colors.badge,
							color: "#fff",
							fontSize: 13,
							fontWeight: 700,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
							boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
						}}
					>
						{stepNum}
					</span>
					<span
						style={{
							fontSize: 12,
							fontWeight: 500,
							color: "#262626",
							lineHeight: 1.4,
							textAlign: "left",
							overflow: "hidden",
							textOverflow: "ellipsis",
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							flex: 1,
						}}
					>
						{data.label}
					</span>
				</div>
				<span
					style={{
						alignSelf: "flex-start",
						fontSize: 10,
						fontWeight: 600,
						color: pathType === "mobile" ? "#1890ff" : pathType === "email" ? "#52c41a" : "#8c8c8c",
						background: pathType === "mobile" ? "rgba(24,144,255,0.12)" : pathType === "email" ? "rgba(82,196,26,0.12)" : "rgba(0,0,0,0.06)",
						padding: "2px 8px",
						borderRadius: 6,
					}}
				>
					{pathLabel}
				</span>
			</div>
			<Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
		</>
	);
}

export function AuthFlowDiagram({ steps, columns }: AuthFlowDiagramProps) {
	const { t } = useTranslation();
	const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

	const nodeTypes = useMemo(
		() => ({
			flowStep: (props: { data: { label: string; stepId: string; pathType?: AuthFlowPathType }; selected?: boolean }) => (
				<FlowNode data={props.data} selected={props.selected} />
			),
		}),
		[]
	);

	const getStep = useCallback((stepId: string) => steps.find((s) => s.id === stepId), [steps]);

	const initialNodes = useMemo(() => {
		const step = (id: string) => getStep(id);
		const { COL_LEFT, COL_CENTER, COL_RIGHT, row } = LAYOUT;
		return [
			{ id: "step1", type: "flowStep", position: { x: COL_CENTER, y: row(0) }, data: { label: step("step1")?.label ?? "step1", stepId: "step1", pathType: step("step1")?.pathType ?? "common" } },
			{ id: "step1mobile", type: "flowStep", position: { x: COL_LEFT, y: row(1) }, data: { label: step("step1mobile")?.label ?? "step1mobile", stepId: "step1mobile", pathType: "mobile" } },
			{ id: "stepAuthStatus", type: "flowStep", position: { x: COL_LEFT, y: row(2) }, data: { label: step("stepAuthStatus")?.label ?? "stepAuthStatus", stepId: "stepAuthStatus", pathType: "mobile" } },
			{ id: "stepNotifyResend", type: "flowStep", position: { x: COL_LEFT, y: row(3) }, data: { label: step("stepNotifyResend")?.label ?? "stepNotifyResend", stepId: "stepNotifyResend", pathType: "mobile" } },
			{ id: "step1alt", type: "flowStep", position: { x: COL_RIGHT, y: row(1) }, data: { label: step("step1alt")?.label ?? "step1alt", stepId: "step1alt", pathType: "email" } },
			{ id: "step2", type: "flowStep", position: { x: COL_RIGHT, y: row(2) }, data: { label: step("step2")?.label ?? "step2", stepId: "step2", pathType: "email" } },
			{ id: "stepResendEmail", type: "flowStep", position: { x: COL_RIGHT, y: row(3) }, data: { label: step("stepResendEmail")?.label ?? "stepResendEmail", stepId: "stepResendEmail", pathType: "email" } },
			{ id: "step3", type: "flowStep", position: { x: COL_RIGHT, y: row(4) }, data: { label: step("step3")?.label ?? "step3", stepId: "step3", pathType: "email" } },
			{ id: "step4", type: "flowStep", position: { x: COL_CENTER, y: row(5) }, data: { label: step("step4")?.label ?? "step4", stepId: "step4", pathType: "common" } },
			{ id: "step5", type: "flowStep", position: { x: COL_CENTER, y: row(6) }, data: { label: step("step5")?.label ?? "step5", stepId: "step5", pathType: "common" } },
			{ id: "step6", type: "flowStep", position: { x: COL_CENTER, y: row(7) }, data: { label: step("step6")?.label ?? "step6", stepId: "step6", pathType: "common" } },
			{ id: "step7", type: "flowStep", position: { x: COL_CENTER, y: row(8) }, data: { label: step("step7")?.label ?? "step7", stepId: "step7", pathType: "common" } },
		];
	}, [getStep, steps]) as Node[];

	// 분기: 모바일 step1 → step1mobile → step4 (알림 재전송은 대기 중 step1mobile에서 호출 가능)
	const initialEdges = useMemo(
		() => [
			{ id: "e1-1m", source: "step1", target: "step1mobile", label: t("sys.page.authFlow.edges.pushDeviceAvailable"), animated: true, style: { stroke: "#1890ff", strokeWidth: 2 }, labelStyle: { fontSize: 11 }, labelBgStyle: { fill: "#e6f7ff" }, labelBgPadding: [4, 2], labelBgBorderRadius: 4 },
			{ id: "e1m-status", source: "step1mobile", target: "stepAuthStatus", style: { stroke: "#1890ff", strokeWidth: 2 } },
			{ id: "e-status-4", source: "stepAuthStatus", target: "step4", label: t("sys.page.authFlow.edges.approved"), style: { stroke: "#1890ff", strokeWidth: 2 }, labelStyle: { fontSize: 10 }, labelBgStyle: { fill: "#fff" }, labelBgPadding: [2, 2], labelBgBorderRadius: 2 },
			{ id: "e1m-notify", source: "step1mobile", target: "stepNotifyResend", label: t("sys.page.authFlow.edges.resendNotification"), style: { stroke: "#91d5ff", strokeWidth: 1.5 }, labelStyle: { fontSize: 10 } },
			{ id: "e1-2", source: "step1", target: "step2", label: t("sys.page.authFlow.edges.pushDeviceUnavailable"), animated: true, style: { stroke: "#52c41a", strokeWidth: 2 }, labelStyle: { fontSize: 11 }, labelBgStyle: { fill: "#f6ffed" }, labelBgPadding: [4, 2], labelBgBorderRadius: 4 },
			{ id: "e1a-2", source: "step1alt", target: "step2", label: t("sys.page.authFlow.edges.enterEmailForm"), animated: true, style: { stroke: "#52c41a", strokeWidth: 2 }, labelStyle: { fontSize: 11 }, labelBgStyle: { fill: "#f6ffed" }, labelBgPadding: [4, 2], labelBgBorderRadius: 4 },
			{ id: "e2-resend", source: "step2", target: "stepResendEmail", label: t("sys.page.authFlow.edges.resendCode"), style: { stroke: "#b7eb8f", strokeWidth: 1.5 }, labelStyle: { fontSize: 10 } },
			{ id: "e2-3", source: "step2", target: "step3", style: { stroke: "#8c8c8c", strokeWidth: 2 } },
			{ id: "e3-4", source: "step3", target: "step4", style: { stroke: "#8c8c8c", strokeWidth: 2 } },
			{ id: "e4-5", source: "step4", target: "step5", style: { stroke: "#8c8c8c", strokeWidth: 2 } },
			{ id: "e5-6", source: "step5", target: "step6", style: { stroke: "#8c8c8c", strokeWidth: 2 } },
			{ id: "e6-7", source: "step6", target: "step7", style: { stroke: "#8c8c8c", strokeWidth: 2 } },
		],
		[t]
	) as Edge[];

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	useEffect(() => {
		setEdges(initialEdges);
	}, [initialEdges, setEdges]);

	const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
		setSelectedStepId(node.id);
		setNodes((nds) =>
			nds.map((n) => ({
				...n,
				selected: n.id === node.id,
			}))
		);
	}, [setNodes]);

	const selectedStep = selectedStepId ? steps.find((s) => s.id === selectedStepId) : null;

	return (
		<div style={{ padding: "12px 0" }}>
			<div
				style={{
					height: 920,
					width: "100%",
					minWidth: LAYOUT.MIN_WIDTH,
					borderRadius: 16,
					overflow: "hidden",
					background: "linear-gradient(180deg, #f8fafc 0%, #eef4f9 50%, #e8f0f6 100%)",
					boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,0,0,0.06)",
				}}
			>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onNodeClick={onNodeClick}
					nodeTypes={nodeTypes}
					fitView
					fitViewOptions={{ padding: 0.25, maxZoom: 1.2, minZoom: 0.3 }}
					nodesDraggable={false}
					nodesConnectable={false}
					elementsSelectable={true}
					panOnDrag={true}
					zoomOnScroll={true}
					zoomOnPinch={true}
					proOptions={{ hideAttribution: true }}
					style={{ background: "transparent", borderRadius: 16 }}
					defaultEdgeOptions={{ type: "smoothstep", style: { strokeWidth: 2 } }}
				/>
			</div>
			{selectedStep && (
				<div
					style={{
						marginTop: 20,
						padding: "16px 20px",
						background: "#fff",
						borderRadius: 12,
						border: "1px solid #e8e8e8",
						boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
					}}
				>
					<p
						style={{
							fontWeight: 600,
							marginBottom: 12,
							fontSize: 14,
							color: "#262626",
							display: "flex",
							alignItems: "center",
							gap: 8,
						}}
					>
						<span
							style={{
								width: 24,
								height: 24,
								borderRadius: 6,
								background: "linear-gradient(135deg, #1890ff 0%, #096dd9 100%)",
								color: "#fff",
								fontSize: 12,
								fontWeight: 700,
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							{steps.findIndex((s) => s.id === selectedStep.id) + 1}
						</span>
						{selectedStep.label}
					</p>
					<Table
						size="small"
						columns={columns}
						dataSource={selectedStep.params}
						pagination={false}
						rowKey="key"
					/>
				</div>
			)}
			{!selectedStepId && (
				<p
					style={{
						marginTop: 14,
						color: "#8c8c8c",
						fontSize: 13,
						textAlign: "center",
					}}
				>
					{t("sys.page.authFlow.selectStepTip")}
				</p>
			)}
		</div>
	);
}
