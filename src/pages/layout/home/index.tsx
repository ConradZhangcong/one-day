import { Outlet } from "react-router-dom";

interface HomeLayoutProps {}

const HomeLayout: React.FC<HomeLayoutProps> = () => {
  return (
    <div className="app tw-min-h-screen tw-relative">
      <main className="utp-content-container">
        <Outlet />
      </main>
      <footer className="tw-absolute tw-text-center tw-bottom-0 tw-w-full tw-px-6 tw-py-3">
        <p className="text-gray-600">© 2024 Conrad. 保留所有权利。</p>
        <a
          className="tw-text-gray-500 tw-text-sm"
          href="https://beian.miit.gov.cn"
          target="_blank"
        >
          苏ICP备2024068518号-1
        </a>
      </footer>
    </div>
  );
};

export default HomeLayout;
