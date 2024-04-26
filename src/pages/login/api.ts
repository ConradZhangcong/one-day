import { request } from "@/utils";

/** 注册 */
export const register = (payload: { account: string; authString: string }) =>
  request<{ token: string }>({
    url: "/api/auth/register",
    method: "POST",
    data: payload,
  });

/** 登录 */
export const login = (payload: { account: string; authString: string }) =>
  request<{ token: string }>({
    url: "/api/auth/login",
    method: "POST",
    data: payload,
  });

/** 获取登录信息 */
export const getProfile = () =>
  request({
    url: "/api/auth/profile",
    method: "GET",
  });
