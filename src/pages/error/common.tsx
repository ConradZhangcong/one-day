import { useRouteError } from "react-router-dom";

interface ErrorType {
  statusText?: string;
  message: string;
}

const CommonErrorPage = () => {
  const error = useRouteError() as ErrorType;
  console.error(error);

  return (
    <div className="tw-container tw-py-8 tw-flex tw-justify-center tw-flex-col tw-items-center">
      <h1 className="tw-font-bold tw-text-4xl tw-leading-tight tw-my-8">
        Oops!
      </h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p className="tw-text-muted-foreground tw-my-8">
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
};

export default CommonErrorPage;
