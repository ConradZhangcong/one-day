import { useRequest } from "ahooks";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AddBtn from "./AddBtn";

import { fetchTaskList } from "./api";

const TasksPage = () => {
  const { data, error, loading } = useRequest(fetchTaskList);

  console.log(data, error, loading);

  if (error) {
    return <div>请求失败, 请重试</div>;
  }

  if (loading) {
    return <Skeleton className="h-[125px] w-[250px] rounded-xl" />;
  }

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
      <AddBtn />
    </div>
  );
};

export default TasksPage;
