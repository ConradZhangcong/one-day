const HeaderLayout = () => {
  const navList = [
    { id: "tasks", displayName: "事项", href: "/tasks" },
    { id: "toolbox", displayName: "工具箱", href: "/toolbox" },
  ];

  return (
    <header className="od-layout-header tw-sticky tw-top-0 tw-z-50 tw-border-b tw-bg-background/95 tw-backdrop-blur supports-[backdrop-filter]:tw-bg-background/60">
      <div className="tw-container tw-flex tw-items-center tw-h-14">
        <a className="tw-mr-12" href="/">
          <span className="tw-font-bold">one-day</span>
        </a>
        <nav className="tw-flex tw-items-center tw-gap-6">
          {navList.map((n) => (
            <a
              key={n.id}
              className="tw-transition-colors hover:tw-text-foreground/80 tw-text-foreground/60"
              href={n.href}
            >
              {n.displayName}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default HeaderLayout;
