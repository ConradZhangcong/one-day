import { useNavigate } from "react-router-dom";

import TargetList from "./TargetList";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <section className="tw-mx-auto tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-8 md:tw-py-12 md:tw-pb-8 lg:tw-py-24 lg:tw-pb-20">
      <h1 className="tw-text-center tw-text-3xl tw-font-bold tw-leading-tight md:tw-text-6xl lg:tw-leading-[1.1]">
        Hi, here is conrad
      </h1>
      <i className="tw-text-center tw-text-base tw-text-slate-500 sm:tw-text-base">
        A Frontend developer, working hard to be a great developer.
      </i>
      <p className="tw-text-center tw-text-sm tw-text-gray-400 sm:tw-text-sm">
        Love coding. Love world. Enjoy now.
      </p>
      <p className="tw-text-center tw-text-sm tw-text-gray-400 sm:tw-text-sm">
        🎨 Obsession with coding cleanness.
      </p>

      <div className="tw-mt-20">
        <TargetList />

        <div className="tw-flex tw-mt-10">
          <span className="tw-mr-2">📧</span>
          <span className="tw-mr-2">contact me via</span>
          <a
            className="tw-text-sky-500 hover:tw-text-sky-600"
            href="mailto:heisenberg0519@outlook.com"
          >
            <strong>Outlook</strong>
          </a>
        </div>
      </div>

      <div className="tw-mt-10">
        <a
          className="tw-flex tw-items-center tw-text-sky-500 hover:tw-text-sky-600 tw-cursor-pointer"
          onClick={() => navigate("/oneday", { state: { from: "xxxpage" } })}
        >
          <span>go to oneday</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="tw-h-4 tw-w-4 tw-ml-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            ></path>
          </svg>
        </a>
      </div>
    </section>
  );
};

export default HomePage;
