import { Outlet } from "react-router-dom";
import Header from "./Header";

interface LayoutProps {}

const Layout: React.FC<LayoutProps> = () => {
  return (
    <>
      <Header />
      <main className="od-content-container">
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
