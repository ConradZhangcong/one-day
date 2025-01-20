import { cn } from "@/lib/utils";

interface ICPFooterProps {
  className?: string;
  bordered?: boolean;
}

/**
 * @desc ICP备案号 底部信息
 */
const ICPFooter: React.FC<ICPFooterProps> = ({ className, bordered }) => {
  return (
    <footer
      className={cn(
        className,
        "tw-text-center tw-bottom-0 tw-w-full tw-px-6 tw-py-3 tw-bg-white",
        bordered ? "tw-border-t border-zinc-200	" : ""
      )}
    >
      <p className="tw-text-gray-500">© 2024 Conrad. 保留所有权利。</p>
      <a
        className="tw-text-gray-400 tw-text-sm"
        href="https://beian.miit.gov.cn"
        target="_blank"
      >
        苏ICP备2024068518号-1
      </a>
    </footer>
  );
};

export default ICPFooter;
