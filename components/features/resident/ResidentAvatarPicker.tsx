"use client";
import { AVATAR_OPTIONS } from "../../../features/resident/constants/avatars";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ResidentAvatarPicker({ value, onChange, disabled }: Props) {
  return (
    <div>
      <div className="mb-2 font-semibold">Avatar</div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-3xl">
          {AVATAR_OPTIONS.find((a) => a.id === value)?.label || "👤"}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => {}} disabled>
          Elegir avatar
        </Button>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {AVATAR_OPTIONS.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl border transition-all ${
              value === avatar.id ? "border-brand-600 ring-2 ring-brand-300" : "border-slate-200"
            }`}
            onClick={() => onChange(avatar.id)}
            disabled={disabled}
            aria-label={avatar.label}
          >
            {avatar.label}
          </button>
        ))}
      </div>
    </div>
  );
}
