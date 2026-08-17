import { CheckOutlined, GlobalOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";

import type { AppLocale } from "@/locales/locale-meta";
import useLocale, { LANGUAGE_MAP } from "@/locales/use-locale";

import { SvgIcon } from "../icon";

import type { MenuProps } from "antd";

type Props = {
	/**
	 * `icon` for the app header, `labeled` for public pages where the control
	 * has to be discoverable without hovering.
	 */
	variant?: "icon" | "labeled";
	className?: string;
};

/**
 * Locale Picker — hidden when only one locale is available.
 *
 * Icons come from `@ant-design/icons` and the local SVG sprite on purpose:
 * `Iconify` resolves icons over the network, which leaves an empty trigger on
 * air-gapped installs.
 */
export default function LocalePicker({ variant = "icon", className }: Props) {
	const { setLocale, locale, language } = useLocale();
	const locales = Object.values(LANGUAGE_MAP);

	if (locales.length <= 1) {
		return null;
	}

	const items: MenuProps["items"] = locales.map((item) => ({
		key: item.locale,
		icon: <SvgIcon icon={item.icon} size="18" className="rounded-sm" />,
		label: (
			<span className="flex min-w-[6.5rem] items-center justify-between gap-4">
				<span>{item.label}</span>
				{item.locale === locale && <CheckOutlined className="text-xs opacity-70" />}
			</span>
		),
	}));

	const menu: MenuProps = {
		items,
		selectedKeys: [locale],
		onClick: ({ key }) => setLocale(key as AppLocale),
	};

	// Native <button>/antd Button so Dropdown can attach a ref (React 19
	// removed findDOMNode). Portal to body to avoid overflow clipping.
	const dropdownProps = {
		placement: "bottomRight" as const,
		trigger: ["click"] as ("click")[],
		menu,
		getPopupContainer: () => document.body,
	};

	if (variant === "labeled") {
		return (
			<Dropdown {...dropdownProps}>
				<Button shape="round" icon={<GlobalOutlined />} className={className} aria-label="Change language">
					{language.shortLabel}
				</Button>
			</Dropdown>
		);
	}

	return (
		<Dropdown {...dropdownProps}>
			<button
				type="button"
				className={
					className ??
					"flex h-10 w-10 cursor-pointer items-center justify-center rounded-full p-2 hover:bg-gray-500/10 hover:scale-105"
				}
				aria-label="Change language"
			>
				<SvgIcon icon={language.icon} size="24" className="rounded-md" />
			</button>
		</Dropdown>
	);
}
