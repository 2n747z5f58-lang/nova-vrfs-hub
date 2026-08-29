import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sounds";

export function SoundSettings() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(isSoundEnabled()), []);
  return <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"><div><p className="text-sm font-medium">Interface sounds</p><p className="mt-1 text-xs text-muted-foreground">Quiet feedback after your interactions.</p></div><button aria-label={enabled ? "Disable interface sounds" : "Enable interface sounds"} onClick={() => { const next = !enabled; setEnabled(next); setSoundEnabled(next); }} className="rounded-md border border-border p-2 hover:bg-accent">{enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button></div>;
}
