import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import useModal from "@/hooks/useModal";

const TasksPage = () => {
  const [modal] = useModal();

  const openAddModal = () => {
    modal.open({
      title: "标题",
      content: <div>content</div>,
    });
  };

  return (
    <div className="tw-mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Task Page</p>
        </CardContent>
        <CardFooter>
          <p>Card Footer</p>
        </CardFooter>
      </Card>
      {/* {modal.renderModal()} */}
      <Button onClick={openAddModal}>新增事项</Button>
    </div>
  );
};

export default TasksPage;
