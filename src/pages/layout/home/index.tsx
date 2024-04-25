import { Outlet } from "react-router-dom";
import ICPFooter from "@/components/common/icp-footer";

interface HomeLayoutProps {}

const HomeLayout: React.FC<HomeLayoutProps> = () => {
  return (
    <div className="utp-content-container tw-min-h-screen">
      <Outlet />
      <ICPFooter className="tw-sticky tw-top-full" bordered />
    </div>
  );
};

export default HomeLayout;
