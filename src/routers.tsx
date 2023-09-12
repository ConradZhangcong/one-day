import { createBrowserRouter } from "react-router-dom";

import Config from "./pages/config";
import System from "./pages/system/main";

const router = createBrowserRouter([
  {
    path: "/system",
    element: <System />,
  },
  {
    path: "/config",
    element: <Config />,
  },
]);

export default router;
