import type { ButtonHTMLAttributes } from "react";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};
export function Button({
  variant = "secondary",
  className = "",
  ...props
}: Props) {
  return (
    <button {...props} className={`button button--${variant} ${className}`} />
  );
}
