"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { BadgeCheck, Film, ImageIcon, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { submitVerificationAction } from "@/app/(site)/actions";

// "Verify my Qzino account": a popup with the username and the proof
// (screenshots or a short recording of the Qzino account, logged in, under
// code RAVO50). Sending it opens the player's Discord ticket with the proof
// attached. 4 MB in total (Netlify / Discord limits); longer videos go in
// the ticket afterwards.

const MAX_BYTES = 4 * 1024 * 1024; // keep in sync with submitVerificationAction
const MAX_FILES = 3;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const noop = () => () => {};
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-neon w-full sm:w-auto" disabled={disabled || pending}>
      {pending ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <><ShieldCheck className="size-4" /> Send for verification</>}
    </button>
  );
}

export function VerifyForm({ username, label }: { username: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const client = useSyncExternalStore(noop, () => true, () => false);
  const total = files.reduce((n, f) => n + f.size, 0);
  const tooBig = total > MAX_BYTES;

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
      <button type="button" className="btn btn-neon" onClick={() => setOpen(true)}><BadgeCheck className="size-4" /> {label}</button>
      {client && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
              <motion.form
                action={submitVerificationAction}
                role="dialog" aria-modal="true" aria-label="Verify your Qzino account"
                className="panel w-full min-w-0 max-w-lg p-5 sm:p-7"
                initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Qzino verification</p>
                    <h2 className="mt-1 font-display text-4xl leading-none"><span className="chrome">Prove it&apos;s you</span></h2>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl border border-line text-muted hover:text-text" aria-label="Close"><X className="size-4" /></button>
                </div>

                <label className="mt-6 block">
                  <span className="label">Your Qzino username</span>
                  <input name="qzino" required defaultValue={username} maxLength={64} pattern="[\w.\-]+" placeholder="exact username on Qzino" className="field font-mono" autoFocus />
                </label>

                <div className="mt-5">
                  <span className="label">Proof: screenshot or short recording</span>
                  <ul className="mb-3 space-y-1 text-xs text-muted">
                    <li>• Your Qzino account, <b className="text-text">logged in</b>, with the username visible</li>
                    <li>• Showing you play <b className="text-text">under code RAVO50</b> (affiliate / promo section)</li>
                  </ul>
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
                            <span className="text-xs text-dim">{f.type.startsWith("image/") ? <ImageIcon className="mr-1 inline size-3" /> : null}{mb(f.size)}</span>
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

                <p className="mt-4 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-muted">
                  This opens your private Discord ticket with everything attached. The team checks it and verifies you here. Never send passwords or login codes.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                  <Submit disabled={files.length === 0 || tooBig} />
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body)}
    </>
  );
}
