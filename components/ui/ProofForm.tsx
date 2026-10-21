"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Film, Loader2, Upload, X } from "lucide-react";

// A button that opens a popup form with proof uploads (screenshots / a short
// recording) and sends it to a Server Action, which opens the player's
// Discord ticket with the proof attached. Used by Qzino verification and
// challenge claims. 4 MB in total (Netlify request cap / Discord attachment
// limit, checked again on the server); longer videos go in the ticket after.

export const PROOF_MAX_BYTES = 4 * 1024 * 1024; // keep in sync with readProof in app/(site)/actions.ts
const MAX_FILES = 3;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const noop = () => () => {};
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function Submit({ disabled, label, icon }: { disabled: boolean; label: string; icon: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-neon w-full sm:w-auto" disabled={disabled || pending}>
      {pending ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <>{icon} {label}</>}
    </button>
  );
}

export function ProofForm({
  action, trigger, triggerClass = "btn btn-neon", eyebrow, title, hidden = {}, children, proofLabel, bullets, note, submitLabel, submitIcon,
}: {
  action: (form: FormData) => Promise<void>;
  trigger: ReactNode;
  triggerClass?: string;
  eyebrow: string;
  title: string;
  hidden?: Record<string, string>;
  /** extra fields above the proof */
  children?: ReactNode;
  proofLabel: string;
  bullets: ReactNode[];
  note: string;
  submitLabel: string;
  submitIcon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const client = useSyncExternalStore(noop, () => true, () => false);
  const total = files.reduce((n, f) => n + f.size, 0);
  const tooBig = total > PROOF_MAX_BYTES;

  // keep the real <input type=file> in sync with the list shown (so the form submits it)
  useEffect(() => {
    if (!input.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.current.files = dt.files;
  }, [files]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list].filter((f) => ACCEPT.split(",").includes(f.type));
    setFiles((cur) => [...cur, ...ok].slice(0, MAX_FILES));
  };

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>{trigger}</button>
      {client && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
              <motion.form
                action={action}
                role="dialog" aria-modal="true" aria-label={title}
                className="panel w-full min-w-0 max-w-lg p-5 text-left sm:p-7"
                initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">{eyebrow}</p>
                    <h2 className="mt-1 font-display text-4xl leading-none"><span className="chrome">{title}</span></h2>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-text" aria-label="Close"><X className="size-4" /></button>
                </div>

                {children && <div className="mt-6 space-y-4">{children}</div>}

                <div className="mt-5">
                  <span className="label">{proofLabel}</span>
                  <ul className="mb-3 space-y-1 text-xs text-muted">{bullets.map((b, i) => <li key={i}>• {b}</li>)}</ul>
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${drag ? "border-neon bg-neon/10" : "border-line hover:border-neon/50"} ${files.length >= MAX_FILES ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Upload className="size-6 text-neon" />
                    <span><b>Drop files here</b> or click to choose</span>
                    <span className="text-xs text-dim">PNG, JPG, WEBP, GIF, MP4, WEBM, MOV · up to {MAX_FILES} files · 4 MB total</span>
                    <input ref={input} type="file" name="proof" accept={ACCEPT} multiple className="sr-only" onChange={(e) => add(e.target.files)} />
                  </label>

                  {files.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {files.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-line bg-bg-2 px-3 py-2 text-sm">
                          {f.type.startsWith("image/")
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={URL.createObjectURL(f)} alt="" className="size-10 rounded-lg object-cover" />
                            : <span className="grid size-10 place-items-center rounded-lg bg-surface-3 text-neon"><Film className="size-5" /></span>}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{f.name}</span>
                            <span className="text-xs text-dim">{mb(f.size)}</span>
                          </span>
                          <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="text-muted hover:text-danger" aria-label={`Remove ${f.name}`}><X className="size-4" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={`mt-2 text-xs ${tooBig ? "font-semibold text-danger" : "text-dim"}`}>
                    {mb(total)} / 4 MB{tooBig ? ": too big. Use a screenshot here and send the long video in your ticket." : ""}
                  </p>
                </div>

                <p className="mt-4 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-muted">{note}</p>
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                  <Submit disabled={files.length === 0 || tooBig} label={submitLabel} icon={submitIcon} />
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body)}
    </>
  );
}
