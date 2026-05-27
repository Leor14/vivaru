"use client";

import * as React from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional inline error if user tries to advance without answering. */
  error?: string;
};

export function ViewQuestion({ title, subtitle, children, error }: Props) {
  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-h2 text-navy text-balance md:text-[40px] md:leading-[1.1]">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm leading-relaxed text-slate-600">{subtitle}</p>
        ) : null}
      </header>
      <div>{children}</div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
