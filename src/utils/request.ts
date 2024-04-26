export type Method = "GET" | "POST" | "PUT" | "DELETE";

/** 请求参数类型 */
export interface RequestParams {
  url: string;
  method: Method;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  headers?: HeadersInit;
}

// #region 返回结果类型
/** 返回结果状态码 */
export enum ResponseCode {
  Ok = 200,
  Created = 201,
  Unauthorized = 401,
  InternalServerError = 500,
}

/** 成功状态码数组, 返回结果类型中会包含 data 属性 */
const SuccessReponseCodes = [ResponseCode.Ok, ResponseCode.Created] as const;

/** 请求成功状态码 */
export type SuccessReponseCode = (typeof SuccessReponseCodes)[number];

/** 请求失败状态码 */
export type FailureResponseCode = Exclude<ResponseCode, SuccessReponseCode>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface BaseResponseType<T> {
  code: ResponseCode;
  message?: string;
  error?: string;
  path?: string;
  timestamp?: string;
}

/** 请求成功返回结果 */
export interface SuccessResponseType<T> extends BaseResponseType<T> {
  code: SuccessReponseCode;
  data: T;
}

/** 请求失败返回结果 */
export type FailureResponseType<T> = BaseResponseType<T> & {
  code: FailureResponseCode;
};

/** 返回结果类型 */
export type ResponseType<T> = SuccessResponseType<T> | FailureResponseType<T>;
// #endregion

/** 获取token */
const getToken = (): string => {
  const token = localStorage.getItem("token");
  if (token) {
    return `Bearer ${token}`;
  }

  return "";
};

/** 请求工具统一封装 */
const request = <T>({
  url,
  method,
  headers,
  params,
  data,
}: RequestParams): Promise<ResponseType<T>> => {
  let requestUrl = url;
  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken(),
      ...headers,
    },
  };

  // 处理请求路径
  if (params) {
    const cloneParams = structuredClone(params);
    requestUrl = url.replace(/\{\w+\}/g, (match) => {
      // 去除匹配出来的字符的首位{}
      const key = match.substring(1, match.length - 1);
      const value = cloneParams[key] as string;
      delete cloneParams[key];
      return value;
    });
    // 将剩余参数拼接在url后
    const restUrlParams = new URLSearchParams(
      cloneParams as Record<string, string>
    );
    const restUrlParamsStr = restUrlParams.toString();
    // url是否已经包含?
    const containsQuestionMark = requestUrl.indexOf("?") > -1;
    requestUrl += `${containsQuestionMark ? "&" : "?"}${restUrlParamsStr}`;
  }

  // 拼接请求主体参数
  if (data) {
    if (method === "GET") {
      console.error("Get请求无法携带请求主体, 请检查是否参数错误: ", {
        method,
        params,
        data,
      });
    } else {
      Object.assign(requestOptions, { body: JSON.stringify(data) });
    }
  }

  return fetch(requestUrl, requestOptions)
    .then((response) => {
      return response.json() as Promise<ResponseType<T>>;
    })
    .then((resJson) => {
      if (resJson.code === ResponseCode.Unauthorized) {
        // TODO: 提示登录过期
        // window.toast?.();
        // 未授权, 打开登录页面
        window.navigate?.("/auth");
      }

      return resJson;
    })
    .catch((error) => {
      console.error("Error: ", error);
      return { code: ResponseCode.InternalServerError };
    });
};

export default request;
