import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

const shortcuts = [
  ["Rotate the model", ["←", "↑", "↓", "→"]],
  ["Zoom in / out", ["+", "−"]],
  ["Pause / resume", ["Space"]],
  ["Next / previous model", ["N", "P"]],
  ["Separate / merge parts", ["E"]],
  ["Reset the view", ["R"]],
  ["Exit presentation", ["Esc"]],
  ["Show these shortcuts", ["?"]],
] as const;

export function ShortcutDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="shortcuts-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="shortcuts-title"
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <Icon name="keyboard" size={25} />
        </span>
        <button
          autoFocus
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close keyboard shortcuts"
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 id="shortcuts-title">A few useful shortcuts.</h2>
      <p>Stay in the flow of your lesson.</p>
      <dl className="shortcut-list">
        {shortcuts.map(([label, keys]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="dialog-note">
        <Icon name="info" size={16} />
        <span>Shortcuts are paused while you type or use a control.</span>
      </div>
    </dialog>
  );
}
