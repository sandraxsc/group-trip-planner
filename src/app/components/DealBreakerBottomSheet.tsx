import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { DuoButton } from "./DuoButton";
import type {
  DealBreakerCategory,
  DealBreakerSelection,
} from "../screens/PreferenceDealBreakerScreen";

export function DealBreakerBottomSheet(props: {
  category: DealBreakerCategory | null;
  selections: DealBreakerSelection[];
  onSave: (updated: DealBreakerSelection) => void;
  onClose: () => void;
}) {
  const { category, selections, onSave, onClose } = props;
  const [open, setOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    if (!category) {
      setOpen(false);
      return;
    }
    const existing = selections.find((s) => s.category === category.id);
    setSelectedTags(existing?.tags ?? []);
    setNote(existing?.note ?? "");
    setFreeText(category.hasFreeText ? (existing?.note ?? "") : "");
    requestAnimationFrame(() => setOpen(true));
    // Init local draft only when opening a category, not on parent auto-save ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id]);

  const handleClose = () => {
    setOpen(false);
    window.setTimeout(onClose, 200);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const noteTagSelected =
    category != null &&
    !category.hasFreeText &&
    category.tags.some((t) => t.hasNote && selectedTags.includes(t.id));

  const handleDone = () => {
    if (!category) return;
    if (category.hasFreeText) {
      const trimmed = freeText.trim();
      onSave({
        category: category.id,
        tags: [],
        ...(trimmed ? { note: trimmed } : {}),
      });
    } else {
      const trimmedNote = note.trim();
      onSave({
        category: category.id,
        tags: selectedTags,
        ...(noteTagSelected && trimmedNote ? { note: trimmedNote } : {}),
      });
    }
    handleClose();
  };

  if (!category) return null;

  return (
    <SheetBackdrop open={open} onBackdropClick={handleClose}>
      <SheetPanel open={open}>
        <div className="w-10 h-1 rounded-full bg-[#D4D4D4] mx-auto mb-4" />

        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{category.emoji}</span>
            <h2 className="font-black text-[#3C3C3C] text-lg leading-tight">
              {category.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X size={18} className="text-[#4B4B4B]" />
          </button>
        </div>

        <p className="text-[#AFAFAF] font-bold text-sm mb-4">Select all that apply.</p>

        {category.hasFreeText ? (
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Describe anything the group should absolutely avoid"
            rows={4}
            className="w-full rounded-2xl border-2 border-[#E5E5E5] bg-white px-4 py-3 text-[#3C3C3C] font-bold text-sm placeholder:text-[#C4C4C4] focus:outline-none focus:border-[#1CB0F6] resize-none mb-4"
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4 max-h-[40vh] overflow-y-auto">
              {category.tags.map((tag) => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-2 rounded-full border-2 font-bold text-sm transition-all ${
                      selected
                        ? "bg-[#1CB0F6] border-[#1CB0F6] text-white shadow-[0_2px_0_#0B8FCC]"
                        : "bg-white border-[#E5E5E5] text-[#4B4B4B] shadow-[0_2px_0_#D4D4D4]"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
            {noteTagSelected && (
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Please specify"
                className="w-full rounded-2xl border-2 border-[#E5E5E5] bg-white px-4 py-3 text-[#3C3C3C] font-bold text-sm placeholder:text-[#C4C4C4] focus:outline-none focus:border-[#1CB0F6] mb-4"
              />
            )}
          </>
        )}

        <DuoButton onClick={handleDone} variant="primary" fullWidth className="py-4 text-base">
          Done
        </DuoButton>
      </SheetPanel>
    </SheetBackdrop>
  );
}

function SheetBackdrop(props: {
  open: boolean;
  onBackdropClick: () => void;
  children: ReactNode;
}) {
  const { open, onBackdropClick, children } = props;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close sheet"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onBackdropClick}
      />
      {children}
    </div>
  );
}

function SheetPanel(props: { open: boolean; children: ReactNode }) {
  const { open, children } = props;
  return (
    <div
      className={`relative bg-white rounded-t-3xl px-5 pt-3 pb-8 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {children}
    </div>
  );
}
