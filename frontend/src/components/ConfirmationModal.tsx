import { useCallback, useEffect, useRef, useState } from 'react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  mode?: 'hold-to-confirm' | 'standard' | 'alert';
  holdDurationMs?: number;
  holdButtonLabel?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  isDanger?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  title,
  description,
  mode = 'standard',
  holdDurationMs = 5000,
  holdButtonLabel = 'Hold to delete',
  confirmText = 'Confirm',
  cancelText = 'Change my mind',
  onConfirm,
  isDanger = true,
  isLoading = false,
  children,
}: ConfirmationModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isSlidUp, setIsSlidUp] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle open/close slide transitions
  useEffect(() => {
    if (isOpen) {
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
        closingTimeoutRef.current = null;
      }
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsSlidUp(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsSlidUp(false);
      closingTimeoutRef.current = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => {
        if (closingTimeoutRef.current) clearTimeout(closingTimeoutRef.current);
      };
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsSlidUp(false);
    closingTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
      if (closingTimeoutRef.current) clearTimeout(closingTimeoutRef.current);
    };
  }, []);

  const stopHolding = useCallback(() => {
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartRef.current = null;
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const startHolding = useCallback(() => {
    if (isLoading) return;
    setIsHolding(true);
    holdStartRef.current = Date.now();

    const tick = () => {
      if (!holdStartRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, (elapsed / holdDurationMs) * 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        stopHolding();
        void onConfirm?.();
        return;
      }

      holdRafRef.current = requestAnimationFrame(tick);
    };

    holdRafRef.current = requestAnimationFrame(tick);
  }, [holdDurationMs, isLoading, onConfirm, stopHolding]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isRendered) return null;

  const secondsRemaining = Math.max(1, Math.ceil(((100 - holdProgress) / 100) * (holdDurationMs / 1000)));
  const fillColor = isDanger ? '#dc2626' : '#0284c7';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-900/60 backdrop-blur-md transition-opacity duration-300 ease-out ${
        isSlidUp ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className={`w-full max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl shadow-2xl border border-surface-container-high p-6 md:p-8 flex flex-col items-center text-center transition-all duration-300 ease-out transform ${
          isSlidUp ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* Top badge / warning icon */}
        <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[28px]">
            {isDanger ? 'warning' : 'info'}
          </span>
        </div>

        {/* Title */}
        <h2 id="confirmation-modal-title" className="font-headline-md text-headline-md text-on-background mb-2">
          {title}
        </h2>

        {/* Description */}
        {description && (
          <div className="font-body-md text-body-md text-secondary max-w-sm mb-6">
            {description}
          </div>
        )}

        {children}

        {/* Hold-to-confirm mode */}
        {mode === 'hold-to-confirm' && (
          <div className="flex flex-col items-center gap-6 my-2 w-full">
            <p className="text-xs font-label-sm text-secondary uppercase tracking-wider">
              {isHolding ? `Hold for ${secondsRemaining}s to confirm` : 'Press and hold for 5 seconds'}
            </p>

            {/* Circular button that fills inward toward the middle */}
            <button
              type="button"
              aria-label={holdButtonLabel}
              aria-valuenow={Math.round(holdProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              disabled={isLoading}
              onMouseDown={startHolding}
              onMouseUp={stopHolding}
              onMouseLeave={stopHolding}
              onTouchStart={startHolding}
              onTouchEnd={stopHolding}
              onTouchCancel={stopHolding}
              onKeyDown={(e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !isHolding) {
                  e.preventDefault();
                  startHolding();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  stopHolding();
                }
              }}
              className="relative w-32 h-32 rounded-full flex flex-col items-center justify-center select-none cursor-pointer outline-none transition-transform active:scale-95 border-4 border-error/40 shadow-lg overflow-hidden group focus-visible:ring-4 focus-visible:ring-error/50"
              style={{
                // Radial fill toward the middle:
                background: `radial-gradient(circle, transparent ${Math.max(0, 100 - holdProgress)}%, ${fillColor} ${Math.max(0, 100 - holdProgress)}%)`,
                // Inset box-shadow filling from edge inward toward the center:
                boxShadow: `inset 0 0 0 ${Math.ceil((holdProgress / 100) * 64)}px ${fillColor}`,
              }}
            >
              {/* Center icon / countdown text */}
              <div className="relative z-10 flex flex-col items-center justify-center text-on-surface">
                <span
                  className={`material-symbols-outlined text-[32px] transition-colors ${
                    holdProgress > 40 ? 'text-white' : 'text-error'
                  }`}
                >
                  {isLoading ? 'progress_activity' : 'delete_forever'}
                </span>
                <span
                  className={`font-label-sm text-label-sm font-bold uppercase tracking-wider transition-colors mt-1 ${
                    holdProgress > 40 ? 'text-white' : 'text-error'
                  }`}
                >
                  {isLoading ? 'Deleting...' : isHolding ? `${secondsRemaining}s` : 'Hold 5s'}
                </span>
              </div>
            </button>

            {/* Secondary button "Change my mind" underneath fitting site design system */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-xl py-sm rounded-xl border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-bold transition-all duration-150 cursor-pointer shadow-sm hover:scale-[0.98] active:scale-95 focus-visible:ring-2 focus-visible:ring-primary"
            >
              {cancelText}
            </button>
          </div>
        )}

        {/* Standard confirmation mode */}
        {mode === 'standard' && (
          <div className="flex flex-col sm:flex-row gap-sm w-full mt-4 justify-center">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-xl py-sm rounded-xl border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-bold transition-all duration-150 cursor-pointer shadow-sm"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => void onConfirm?.()}
              disabled={isLoading}
              className={`px-xl py-sm rounded-xl text-white font-label-md text-label-md font-bold transition-all duration-150 cursor-pointer shadow-sm ${
                isDanger ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        )}

        {/* Alert / info mode */}
        {mode === 'alert' && (
          <div className="w-full mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleClose}
              className="px-xl py-sm rounded-xl border border-surface-container-high bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-bold transition-all duration-150 cursor-pointer shadow-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
