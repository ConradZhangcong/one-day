import { cn } from "@/lib/utils";

interface LoadingProps {
  loading: boolean;
  children: React.ReactNode;
  fullscreen?: boolean;
}

/**
 * @desc 页面和区块的加载中
 */
const Loading: React.FC<LoadingProps> = ({ loading, children, fullscreen }) => {
  return (
    <div className="od-loading-container tw-relative">
      {loading && (
        <div
          key="loading"
          className={cn(
            fullscreen
              ? "tw-fixed tw-w-screen tw-h-screen tw-z-[1000]"
              : "tw-absolute tw-top-0 tw-w-full tw-h-full",
            "tw-bg-black/[.45] tw-text-white tw-flex tw-justify-center tw-items-center"
          )}
        >
          <span>loading....</span>
        </div>
      )}
      <div key="content">{children}</div>
    </div>
  );
};

export default Loading;
