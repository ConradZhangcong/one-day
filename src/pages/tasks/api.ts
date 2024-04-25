import { request } from "@/utils";

/** 获取事项列表 */
export const fetchTaskList = () =>
  request({
    url: "/api/task",
    method: "GET",
    params: { status: "TODO" },
    data: { test: "123" },
  });
