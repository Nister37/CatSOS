type LoadMoreButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
};

export function LoadMoreButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Load more',
  loadingLabel = 'Loading...',
  className = '',
}: LoadMoreButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-sm px-xl py-md rounded-xl border-2 border-on-background text-on-background font-label-md text-label-md hover:bg-on-background hover:text-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <>
          <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
          {loadingLabel}
        </>
      ) : (
        <>
          {label}
          <span className="material-symbols-outlined text-[18px]">expand_more</span>
        </>
      )}
    </button>
  );
}
