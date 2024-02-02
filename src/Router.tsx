import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Layout from "./pages/layout";
import TasksPage from "./pages/tasks";
import ToolboxPage from "./pages/toolbox";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "tasks", element: <TasksPage /> },
      { path: "toolbox", element: <ToolboxPage /> },
    ],
  },
]);

function Router() {
  return <RouterProvider router={router} />;
}

export default Router;
