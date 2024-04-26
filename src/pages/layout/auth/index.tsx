import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

interface AuthLayoutProps {}

const AuthLayout: React.FC<AuthLayoutProps> = () => {
  const location = useLocation();

  useEffect(() => {
    console.log("location: ", location);
  }, [location]);

  return (
    <div className="utp-content-container tw-min-h-screen">
      <Outlet />
    </div>
  );
};

export default AuthLayout;
