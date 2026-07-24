import { Button } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { toast } from "sonner";

import { t } from "@/locales/i18n";

interface CodeBlockProps {
	code: string;
	language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
	const copy = () => {
		navigator.clipboard.writeText(code);
		toast.success(t("sys.menu.developer.copied"));
	};

	return (
		<div style={{ position: "relative", marginBottom: 16 }}>
			{language && (
				<div
					style={{
						position: "absolute",
						top: 8,
						right: 48,
						fontSize: 11,
						color: "#8c8c8c",
						textTransform: "uppercase",
					}}
				>
					{language}
				</div>
			)}
			<pre
				style={{
					background: "#f5f5f5",
					padding: "16px 48px 16px 16px",
					borderRadius: 8,
					overflow: "auto",
					fontSize: 13,
					lineHeight: 1.5,
					margin: 0,
				}}
			>
				{code}
			</pre>
			<Button
				icon={<CopyOutlined />}
				size="small"
				style={{ position: "absolute", top: 8, right: 8 }}
				onClick={copy}
			>
				{t("sys.menu.developer.step2Copy")}
			</Button>
		</div>
	);
}
