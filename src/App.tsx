import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import routers from "./routers";

function App() {
  const navigate = routers.navigate;

  useEffect(() => {
    console.log("将navigate函数绑定到window对象上");
    // 将navigate函数绑定到window对象上
    window.navigate = navigate;
  }, [navigate]);

  return <RouterProvider router={routers} />;
}

export default App;
