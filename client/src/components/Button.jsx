import clsx from "clsx";

const variants = {
  primary: "bg-moss text-white hover:bg-moss/90",
  secondary: "bg-white text-ink border border-stone-200 hover:bg-stone-50",
  danger: "bg-coral text-white hover:bg-coral/90",
  ghost: "bg-transparent text-ink hover:bg-stone-100",
};

export default function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={clsx(
        "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

