import type { ReactNode } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HelpTip } from "@/components/shared/help-tip";

export function ChartContainer({
  title,
  description,
  controls,
  children,
  helpText,
}: {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
  helpText?: string;
}) {
  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            {helpText ? <HelpTip text={helpText} /> : null}
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        {controls ? <div className="w-full md:w-auto">{controls}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
