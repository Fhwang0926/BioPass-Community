import { Helmet } from "react-helmet-async";

import Logo from "@/assets/images/logo.png";
import Router from "@/router/index";

import { MotionLazy } from "./components/animate/motion-lazy";
import Toast from "./components/toast";
import { AntdAdapter } from "./theme/adapter/antd.adapter";
import { ThemeProvider } from "./theme/theme-provider";

const { VITE_APP_TITLE } = import.meta.env;

function App() {
	return (
		<ThemeProvider adapters={[AntdAdapter]}>
			<MotionLazy>
				<Helmet>
					<title>{VITE_APP_TITLE ? `Welcome, ${VITE_APP_TITLE}` : 'Welcome'}</title>
					<link rel="icon" href={Logo} />
					<link rel="apple-touch-icon" href={Logo} />
					<meta property="og:image" content={Logo} />
					<meta name="twitter:image" content={Logo} />
				</Helmet>
				<Toast />

				<Router />
			</MotionLazy>
		</ThemeProvider>
	);
}

export default App;
