import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { useRequest } from "ahooks";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Loading from "@/components/common/loading";

import { addTask } from "./api";

const formSchema = z
  .object({
    title: z
      .string({ required_error: "请输入标题" })
      .min(1, { message: "请输入标题" }),
    content: z.string(),
    status: z.string(),
    priority: z.string(),
    cycleTime: z.number(),
  })
  .required();

const AddBtn = () => {
  const { runAsync: addTaskRequest, loading } = useRequest(addTask, {
    manual: true,
  });
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      status: "",
      priority: "",
      cycleTime: 0,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (loading) {
      return;
    }

    addTaskRequest({
      title: values.title,
      content: values.content,
      status: values.status,
      priority: values.priority,
      cycleTime: values.cycleTime,
    }).then((res) => {
      if (res.code === 200) {
        toast({ title: "新增成功" });
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>新增事项</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增事项</DialogTitle>
        </DialogHeader>
        <Loading loading>
          <Form {...form}>
            <form
              className="tw-grid tw-gap-2 tw-space-y-2"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>详情</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入详情" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>status</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入status" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>priority</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入priority" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cycleTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>cycleTime</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入cycleTime" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">确定</Button>
            </form>
          </Form>
        </Loading>
      </DialogContent>
    </Dialog>
  );
};

export default AddBtn;
