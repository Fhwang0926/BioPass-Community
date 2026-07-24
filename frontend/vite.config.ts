import path from "node:path";

import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";
import { createSvgIconsPlugin } from "vite-plugin-svg-icons";
import tsconfigPaths from "vite-tsconfig-paths";

// ... existing imports ...

export default defineConfig(({ mode }) => {
	const fileEnv = loadEnv(mode, process.cwd(), "");
	const env = {
		VITE_APP_BASE_API: fileEnv.VITE_APP_BASE_API || "/api",
		VITE_APP_HOMEPAGE: fileEnv.VITE_APP_HOMEPAGE || "/service/dashboard",
		VITE_APP_TITLE: fileEnv.VITE_APP_TITLE || "BioPass",
		VITE_APP_BASE_PATH: fileEnv.VITE_APP_BASE_PATH || "/",
	};
	const base = env.VITE_APP_BASE_PATH;
	const isProduction = mode === "production";

	return {
		base,
		define: {
			"import.meta.env.VITE_APP_BASE_API": JSON.stringify(env.VITE_APP_BASE_API),
			"import.meta.env.VITE_APP_HOMEPAGE": JSON.stringify(env.VITE_APP_HOMEPAGE),
			"import.meta.env.VITE_APP_TITLE": JSON.stringify(env.VITE_APP_TITLE),
			"import.meta.env.VITE_APP_BASE_PATH": JSON.stringify(env.VITE_APP_BASE_PATH),
		},
		plugins: [
			react({
				// 添加 React 插件的优化配置
				babel: {
					parserOpts: {
						plugins: ["decorators-legacy", "classProperties"],
					},
				},
			}),
			vanillaExtractPlugin({
				identifiers: ({ debugId }) => `${debugId}`,
			}),
			tsconfigPaths(),
			createSvgIconsPlugin({
				iconDirs: [path.resolve(process.cwd(), "src/assets/icons")],
				symbolId: "icon-[dir]-[name]",
			}),
			isProduction &&
				process.env.ANALYZE === "1" &&
				visualizer({
					open: true,
					gzipSize: true,
					brotliSize: true,
					template: "treemap",
					filename: "stats.html",
				}),
		].filter(Boolean),

		server: {
			open: true,
			host: true,
			port: 3031,
			proxy: {
				// frontend localhost:3031 → /api 요청을 백엔드 localhost:3030으로 전달 (경로 유지: 백엔드가 /api prefix 사용)
				"/api": {
					target: "http://localhost:3030",
					changeOrigin: true,
					secure: false,
				},
				"/api-docs": {
					target: "http://localhost:3030",
					changeOrigin: true,
					secure: false,
				},
				"/swagger.json": {
					target: "http://localhost:3030",
					changeOrigin: true,
					secure: false,
				},
			},
		},

		build: {
			target: "esnext",
			minify: "esbuild",
			sourcemap: !isProduction,
			cssCodeSplit: true,
			chunkSizeWarningLimit: 1500,
			rollupOptions: {
				output: {
					manualChunks: {
						"vendor-core": ["react", "react-dom", "react-router"],
						"vendor-ui": ["antd", "@ant-design/icons", "@ant-design/cssinjs", "framer-motion", "styled-components"],
						"vendor-utils": ["axios", "dayjs", "i18next", "zustand", "@iconify/react"],
						"vendor-charts": ["apexcharts", "react-apexcharts"],
					},
				},
			},
		},

		// 优化依赖预构建
		optimizeDeps: {
			include: ["react", "react-dom", "react-router", "antd", "@ant-design/icons", "axios", "dayjs"],
			exclude: ["@iconify/react"], // 排除不需要预构建的依赖
		},

		// esbuild 优化配置
		esbuild: {
			drop: isProduction ? ["console", "debugger"] : [],
			legalComments: "none",
			target: "esnext",
		},
	};
});
