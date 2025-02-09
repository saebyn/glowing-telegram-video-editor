import Button from "components/atoms/Button";
import type React from "react";

function IconButton({
  icon,
  className,
  text,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  className?: string;
  icon: string;
  text?: string;
  variant?: "primary" | "danger" | "secondary" | "default";
}) {
  return (
    <Button className={`flex items-center ${className}`} {...props}>
      <span className="material-symbols-outlined size-5 m-2">{icon}</span>
      {text ? <span className="m-2 mr-4">{text}</span> : null}
    </Button>
  );
}

export default IconButton;
