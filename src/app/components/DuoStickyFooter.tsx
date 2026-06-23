import type { ReactNode } from "react";
import { duoUi } from "../constants/duoUi";

export function DuoStickyFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${duoUi.stickyFooter} ${className}`.trim()}>
      <div className={duoUi.contentWidth}>{children}</div>
    </div>
  );
}
