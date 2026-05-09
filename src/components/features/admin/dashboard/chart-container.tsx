import type { ReactNode } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function ChartContainer({
  title,
  description,
  controls,
  children,
}: {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        {controls ? <div className="w-full md:w-auto">{controls}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
