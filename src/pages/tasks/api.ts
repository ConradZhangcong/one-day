import { request } from "@/utils";

/** 获取事项列表 */
export const fetchTaskList = () =>
  request({
    url: "/api/task",
    method: "GET",
    params: { status: "TODO" },
  });

/** 新增事项 */
export const addTask = (paylod: {
  title: string;
  content?: string;
  status?: string;
  priority?: string;
  cycleTime?: number;
}) =>
  request({
    url: "/api/task",
    method: "POST",
    data: paylod,
  });
