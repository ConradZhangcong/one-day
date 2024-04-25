export type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestParams {
  url: string;
  method: Method;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  headers?: HeadersInit;
}

const request = ({ url, method, headers, params, data }: RequestParams) => {
  let requestUrl = url;
  const requestOptions: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
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
    Object.assign(requestOptions, { data: JSON.stringify(data) });
  }

  return fetch(requestUrl, requestOptions)
    .then((response) => {
      console.log(response);
      return response.json();
    })
    .then((data) => {
      if (data.code === 401) {
        // 未授权, 打开登录页面
        console.log("打开登录页面");
        window.navigate("/login");
      } else {
        console.log(data);
      }
    })
    .catch((error) => {
      console.error("Error: ", error);
    });
};

export default request;
