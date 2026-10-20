"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A submit button that asks first, in the site's own dialog (never the
// browser confirm). Put it inside the <form> it submits. The dialog is
// portalled to <body>: an animated ancestor (e.g. .reveal's translate)
// would otherwise trap `position: fixed` inside the row.
const noop = () => () => {};

export function ConfirmButton({
  children,
  title,
  body,
  confirmLabel = "Confirm",
  className = "btn btn-neon",
  danger = false,
  disabled,
}: {
  children: ReactNode;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  className?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  // false while server-rendering and hydrating, true after: no mismatch
  const client = useSyncExternalStore(noop, () => true, () => false);
  return (
    <>
      <button ref={ref} type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {children}
      </button>
      {client && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="panel neon-frame is-on w-full max-w-md p-6 text-left"
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-display text-3xl"><span className="chrome">{title}</span></p>
              {body && <div className="mt-3 text-sm leading-relaxed text-muted">{body}</div>}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} autoFocus>Cancel</button>
                <button
                  type="button"
                  className={`btn btn-sm ${danger ? "btn-ghost !border-danger !text-danger" : "btn-neon"}`}
                  onClick={() => {
                    setOpen(false);
                    ref.current?.form?.requestSubmit();
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </>
  );
}
