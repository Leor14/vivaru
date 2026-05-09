"use client";

import type { ReactNode } from "react";

import { Modal } from "@/components/shared/modal";

export function OperationsDrawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-2">{children}</div>
    </Modal>
  );
}
