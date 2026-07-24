import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * 안전한 lazy import 유틸리티
 * default export가 없거나 undefined인 경우를 처리하여
 * "Element type is invalid" 에러를 방지합니다.
 * 
 * @param importFn - 동적 import 함수
 * @returns LazyExoticComponent
 */
export function safeLazyImport<T extends ComponentType<any>>(
	importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
	return lazy(async () => {
		try {
			const module = await importFn();
			
			// default export가 없는 경우 에러 발생
			if (!module || !module.default) {
				throw new Error(
					`Module does not have a default export. ` +
					`Please ensure the component is exported as default.`
				);
			}
			
			// default export가 함수/컴포넌트가 아닌 경우
			if (typeof module.default !== "function") {
				throw new Error(
					`Default export is not a valid React component. ` +
					`Got: ${typeof module.default}`
				);
			}
			
			return module;
		} catch (error) {
			// 에러를 콘솔에 출력하고 재발생시켜 ErrorBoundary가 처리할 수 있도록 함
			console.error("Failed to lazy load component:", error);
			throw error;
		}
	});
}

