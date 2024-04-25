import { Outlet } from "react-router-dom";

interface HomeLayoutProps {}

const EmptyLayout: React.FC<HomeLayoutProps> = () => {
  return (
    <div className="utp-content-container tw-min-h-screen">
      <Outlet />
    </div>
  );
};

export default EmptyLayout;
