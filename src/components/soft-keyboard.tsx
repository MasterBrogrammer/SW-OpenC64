import { useState } from "react";
import { K } from "@/lib/c64-keys";
import { cn } from "@/lib/utils";

type KeySpec = { label: string; index: number; grow?: boolean };

const ROWS: KeySpec[][] = [
  [
    { label: "←", index: K.ARROW_LEFT },
    { label: "1", index: K.ONE },
    { label: "2", index: K.TWO },
    { label: "3", index: K.THREE },
    { label: "4", index: K.FOUR },
    { label: "5", index: K.FIVE },
    { label: "6", index: K.SIX },
    { label: "7", index: K.SEVEN },
    { label: "8", index: K.EIGHT },
    { label: "9", index: K.NINE },
    { label: "0", index: K.ZERO },
    { label: "+", index: K.PLUS },
    { label: "−", index: K.MINUS },
    { label: "CLR", index: K.HOME },
    { label: "DEL", index: K.DEL },
  ],
  [
    { label: "CTRL", index: K.CTRL },
    { label: "Q", index: K.Q },
    { label: "W", index: K.W },
    { label: "E", index: K.E },
    { label: "R", index: K.R },
    { label: "T", index: K.T },
    { label: "Y", index: K.Y },
    { label: "U", index: K.U },
    { label: "I", index: K.I },
    { label: "O", index: K.O },
    { label: "P", index: K.P },
    { label: "@", index: K.AT },
    { label: "*", index: K.STAR },
    { label: "↑", index: K.ARROW_UP },
    { label: "R/S", index: K.RUN_STOP },
  ],
  [
    { label: "C=", index: K.COMMODORE },
    { label: "A", index: K.A },
    { label: "S", index: K.S },
    { label: "D", index: K.D },
    { label: "F", index: K.F },
    { label: "G", index: K.G },
    { label: "H", index: K.H },
    { label: "J", index: K.J },
    { label: "K", index: K.K },
    { label: "L", index: K.L },
    { label: ":", index: K.COLON },
    { label: ";", index: K.SEMICOLON },
    { label: "=", index: K.EQUALS },
    { label: "RETURN", index: K.RETURN, grow: true },
  ],
  [
    { label: "SHIFT", index: K.SHIFT_LEFT },
    { label: "Z", index: K.Z },
    { label: "X", index: K.X },
    { label: "C", index: K.C },
    { label: "V", index: K.V },
    { label: "B", index: K.B },
    { label: "N", index: K.N },
    { label: "M", index: K.M },
    { label: ",", index: K.COMMA },
    { label: ".", index: K.PERIOD },
    { label: "/", index: K.SLASH },
    { label: "CRSR ↕", index: K.CURSOR_UD },
    { label: "CRSR ↔", index: K.CURSOR_LR },
  ],
  [
    { label: "F1", index: K.F1 },
    { label: "F3", index: K.F3 },
    { label: "F5", index: K.F5 },
    { label: "F7", index: K.F7 },
    { label: "SPACE", index: K.SPACE, grow: true },
  ],
];

export function SoftKeyboard({
  onKey,
  onUp,
}: {
  onKey: (index: number) => void;
  onUp: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-auto shrink-0 md:hidden">
      <button
        type="button"
        className="mt-2 h-11 w-full rounded-md bg-raised text-sm text-muted hover:text-fg"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide keyboard" : "Show keyboard"}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-1">
          {ROWS.map((row, i) => (
            <div key={i} className="flex gap-1 overflow-x-auto">
              {row.map((key) => (
                <button
                  key={key.label}
                  type="button"
                  className={cn(
                    "h-11 min-w-11 rounded-sm bg-raised px-1 font-mono text-[10px] text-fg",
                    key.grow ? "flex-1" : "flex-1",
                  )}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onKey(key.index);
                  }}
                  onPointerUp={() => onUp(key.index)}
                  onPointerLeave={() => onUp(key.index)}
                >
                  {key.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
