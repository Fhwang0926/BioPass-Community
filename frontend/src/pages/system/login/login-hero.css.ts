import { keyframes, style } from "@vanilla-extract/css";

const marquee = keyframes({
	"0%": { transform: "translate3d(0, 0, 0)" },
	"100%": { transform: "translate3d(-50%, 0, 0)" },
});

export const viewport = style({
	position: "relative",
	width: "100%",
	overflow: "hidden",
	maskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
	WebkitMaskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
});

export const track = style({
	display: "flex",
	width: "max-content",
	paddingBlock: "0.75rem 1.5rem",
	animationName: marquee,
	animationDuration: "36s",
	animationTimingFunction: "linear",
	animationIterationCount: "infinite",
	selectors: {
		[`${viewport}:hover &`]: {
			animationPlayState: "paused",
		},
	},
	"@media": {
		"(prefers-reduced-motion: reduce)": {
			animation: "none",
		},
	},
});
