import { Outlet } from "react-router-dom";
import NavHeader from "./nav-header";

interface OneDayLayoutProps {}

const OneDayLayout: React.FC<OneDayLayoutProps> = () => {
  return (
    <div className="utp-content-container tw-min-h-screen">
      <NavHeader />
      <Outlet />
    </div>
  );
};

export default OneDayLayout;
