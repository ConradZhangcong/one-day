const TargetList = () => {
  return (
    <div className="tw-flex tw-h-5 tw-leading-5">
      <span className="tw-mr-2">🏡</span>

      <a
        className="tw-text-sky-500 hover:tw-text-sky-600"
        href="/"
        rel="noreferrer"
        target="_blank"
      >
        <strong>Profile</strong>
      </a>
      <div className="tw-shrink-0 tw-mx-2 tw-bg-gray-400 tw-h-full tw-w-[1px]"></div>
      <a
        className="tw-text-sky-500 hover:tw-text-sky-600"
        href="https://juejin.cn/user/395479916507422/"
        rel="noreferrer"
        target="_blank"
      >
        <strong>Juejin</strong>
      </a>
      <div className="tw-shrink-0 tw-mx-2 tw-bg-gray-400 tw-h-full tw-w-[1px]"></div>
      <a
        className="tw-text-sky-500 hover:tw-text-sky-600"
        href="https://github.com/ConradZhangcong/"
        rel="noreferrer"
        target="_blank"
      >
        <strong>Github</strong>
      </a>
    </div>
  );
};

export default TargetList;
