import { Outlet } from "react-router-dom";
import Header from "./Header";

interface OneDayLayoutProps {}

const OneDayLayout: React.FC<OneDayLayoutProps> = () => {
  return (
    <div className="app tw-min-h-screen">
      <Header />
      <main className="utp-content-container">
        <Outlet />
      </main>
    </div>
  );
};

export default OneDayLayout;
