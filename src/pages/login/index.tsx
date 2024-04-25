import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import ICPFooter from "@/components/common/icp-footer";

const formSchema = z.object({
  account: z.string(),
  password: z.string(),
});

const LoginPage = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
  };

  return (
    <div className="tw-container tw-h-screen md:tw-grid lg:tw-grid-cols-2 lg:tw-max-w-none lg:tw-px-0">
      <div className="tw-p-10 tw-bg-zinc-900 tw-text-white dark:tw-border-r">
        <div className="tw-text-lg tw-font-semibold">One Day</div>
      </div>
      <div className="tw-py-10">
        <div>Register</div>
        <div className="tw-p-8 tw-mx-auto">
          <h1 className="tw-text-center tw-text-2xl tw-font-semibold">Login</h1>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>账号</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入账号" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入密码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">登录</Button>
            </form>
          </Form>
        </div>
        <ICPFooter className="tw-sticky tw-top-full" bordered />
      </div>
    </div>
  );
};

export default LoginPage;
