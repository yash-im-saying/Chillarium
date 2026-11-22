import { X } from 'lucide-react';
import type { SpecimenInfo } from '../types/terrarium';

interface SpeciesInspectorProps {
  specimen: SpecimenInfo | null;
  onDismiss: () => void;
}

export function SpeciesInspector({ specimen, onDismiss }: SpeciesInspectorProps) {
  if (!specimen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-6 z-20 max-w-xs rounded-xl border border-white/12 bg-[rgba(17,22,19,0.9)] px-4 py-3 text-[#e8ede5] shadow-[0_12px_32px_rgba(0,0,0,0.42)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#9cb09e]">
            <span>{specimen.category}</span>
            <span aria-hidden="true">·</span>
            <span className="italic">{specimen.scientificName}</span>
          </div>
          <h2 className="font-display text-base font-medium text-[#f2f6ef] mt-0.5">
            {specimen.commonName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close specimen note"
          className="rounded-md p-1 text-[#95a397] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#bac5b8]">{specimen.note}</p>
    </div>
  );
}
