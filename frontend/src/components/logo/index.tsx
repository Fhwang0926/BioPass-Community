import { NavLink } from "react-router";

import logo from "@/assets/images/logo.png";

interface Props {
	size?: number | string;
}
function Logo({ size = 50 }: Props) {
	return (
		<NavLink to="/">
			<div style={{ borderRadius: '50%', overflow: 'hidden', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
				<img src={logo} alt="Bio Pass" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
			</div>
		</NavLink>
	);
}

export default Logo;
