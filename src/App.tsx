import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import routers from "./routers";

function App() {
  useEffect(() => {
    // 将navigate函数绑定到window对象上
    if (!window.navigate) {
      console.log("bind navigate to window");
      window.navigate = routers.navigate;
    }
  }, []);

  return <RouterProvider router={routers} />;
}

export default App;
