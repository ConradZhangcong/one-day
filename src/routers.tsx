import { createBrowserRouter, Navigate } from "react-router-dom";

import HomeLayout from "./pages/layout/home";
import AuthLayout from "./pages/layout/auth";
import OneDayLayout from "./pages/layout/one-day";

import CommonErrorPage from "./pages/error/common";
import HomePage from "./pages/home";
import TasksPage from "./pages/tasks";
import ToolboxPage from "./pages/toolbox";
import LoginPage from "./pages/login";

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <CommonErrorPage />,
    children: [{ index: true, element: <Navigate to="home" /> }],
  },
  {
    path: "/home",
    element: <HomeLayout />,
    errorElement: <CommonErrorPage />,
    children: [{ index: true, element: <HomePage /> }],
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    errorElement: <CommonErrorPage />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/oneday",
    element: <OneDayLayout />,
    errorElement: <CommonErrorPage />,
    children: [
      { index: true, element: <TasksPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "toolbox", element: <ToolboxPage /> },
    ],
  },
]);

export default router;
