import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";
import { useRequest } from "ahooks";
import { useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
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

import { login } from "./api";

const formSchema = z
  .object({
    account: z
      .string({ required_error: "请输入账号" })
      .min(1, { message: "请输入账号" }),
    password: z
      .string({ required_error: "请输入密码" })
      .min(1, { message: "请输入密码" }),
  })
  .required();

/** 登录页面 */
const LoginPage = () => {
  const { runAsync, loading } = useRequest(login, {
    manual: true,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (loading) {
      return;
    }

    runAsync({ account: values.account, authString: values.password }).then(
      (res) => {
        if (res.code === 200) {
          // 登录成功, token写入本地缓存
          localStorage.setItem("token", res.data.token);
          // 跳转页面到上一级页面
          navigate(-1);
        } else {
          // 登录失败
          toast({
            variant: "destructive",
            title: "登录异常",
            description: res.message,
          });
        }
      }
    );
  };

  return (
    <div className="tw-container tw-h-screen md:tw-grid lg:tw-grid-cols-2 lg:tw-max-w-none lg:tw-px-0">
      <div className="tw-p-10 tw-bg-zinc-900 tw-text-white dark:tw-border-r">
        <Link className="tw-text-lg tw-font-semibold" to="/">
          One Day
        </Link>
      </div>
      <div className="tw-flex tw-flex-col tw-justify-between tw-pt-4">
        <div className="tw-px-8 tw-my-2 tw-text-right">
          <Button variant="ghost">Register</Button>
        </div>
        <div className="tw-flex tw-flex-col tw-mx-auto tw-mb-12 sm:tw-w-[350px] tw-gap-4">
          <h1 className="tw-text-center tw-text-2xl tw-font-semibold">Login</h1>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="tw-grid tw-gap-2 tw-space-y-2"
            >
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
        <ICPFooter className="tw-sticky tw-top-full tw-mt-6" bordered />
      </div>
    </div>
  );
};

export default LoginPage;
