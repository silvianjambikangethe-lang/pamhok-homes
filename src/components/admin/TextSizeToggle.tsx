"use client";

import { useAdminTextSize, type TextScale } from "@/components/admin/AdminTextSizeContext";

const STEPS: { value: TextScale; label: string }[] = [
  { value: 1, label: "A" },
  { value: 1.25, label: "A+" },
  { value: 1.5, label: "A++" },
];

export default function TextSizeToggle({
  colorClassName = "text-white",
}: {
  colorClassName?: string;
}) {
  const { scale, setScale } = useAdminTextSize();

  return (
    <div
      role="group"
      aria-label="Text size"
      className="flex items-center gap-0.5 rounded-full border border-white/20 p-0.5"
    >
      {STEPS.map((step) => (
        <button
          key={step.value}
          type="button"
          onClick={() => setScale(step.value)}
          aria-pressed={scale === step.value}
          aria-label={
            step.value === 1
              ? "Default text size"
              : step.value === 1.25
                ? "Larger text size"
                : "Largest text size"
          }
          className={`focus-ring rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            scale === step.value
              ? "bg-white text-forest-700"
              : `${colorClassName} hover:bg-white/10`
          }`}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}
