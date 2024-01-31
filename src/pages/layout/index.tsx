import Header from "./Header";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Header />
      <main className="od-content-container tw-mt-6">
        {children}
      </main>
    </>
  );
};

export default Layout;
