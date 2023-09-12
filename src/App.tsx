import { RouterProvider } from "react-router-dom";

import router from "./routers";

function App() {
  return (
    <div className="od-page">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
