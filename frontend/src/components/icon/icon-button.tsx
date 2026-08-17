import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/utils";

type Props = {
	children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Forwards the ref so antd overlays (Dropdown, Tooltip, Popconfirm) can anchor
 * to the button. React 19 removed the findDOMNode fallback they relied on.
 */
const IconButton = forwardRef<HTMLButtonElement, Props>(({ children, className, ...rest }, ref) => (
	<button
		ref={ref}
		type="button"
		className={cn(
			"flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-gray-500/10",
			className,
		)}
		{...rest}
	>
		{children}
	</button>
));

IconButton.displayName = "IconButton";

export default IconButton;
