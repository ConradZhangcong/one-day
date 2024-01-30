import Layout from "./pages/layout";
import TasksPage from "./pages/tasks";

function App() {
  return (
    <div className="app tw-min-h-screen">
      <Layout>
        <TasksPage />
      </Layout>
    </div>
  );
}

export default App;
