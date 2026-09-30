"use client";

import type { ReactNode } from "react";
import type { Severity } from "@/lib/types";
import { IconAlert, IconCheck, IconClose, IconInfo, IconSparkle } from "./Icons";

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "soft" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const v = {
    primary: "bg-accent text-white hover:brightness-110 active:brightness-95",
    danger: "bg-crit text-white hover:brightness-110",
    soft: "bg-accent-soft text-brand hover:brightness-97",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-2",
  }[variant];
  const s = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-[15px]" }[size];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:opacity-40 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
}

const SEV: Record<Severity, { label: string; cls: string; Icon: typeof IconInfo }> = {
  critical: { label: "Needs you now", cls: "bg-crit-soft text-crit", Icon: IconAlert },
  warning: { label: "Heads up", cls: "bg-warn-soft text-warn", Icon: IconAlert },
  info: { label: "Insight", cls: "bg-accent-soft text-brand", Icon: IconSparkle },
  positive: { label: "Opportunity", cls: "bg-good-soft text-good", Icon: IconCheck },
};

export function SeverityChip({ severity }: { severity: Severity }) {
  const { label, cls, Icon } = SEV[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon size={12} strokeWidth={2.4} />
      {label}
    </span>
  );
}

export function Sheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="anim-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="anim-sheet relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-surface pb-6 shadow-2xl no-scrollbar">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 px-5 pb-2 pt-3 backdrop-blur">
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <div className="pt-2 text-[15px] font-semibold">{title}</div>
          <button onClick={onClose} className="mt-1 rounded-full p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="px-5">{children}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{children}</h2>
      {right}
    </div>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-line bg-surface p-4 ${onClick ? "cursor-pointer transition hover:border-accent/40" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
