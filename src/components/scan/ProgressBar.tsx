type ProgressBarProps = {
  progress: number;
  className?: string;
};

export function ProgressBar({ progress, className = "" }: ProgressBarProps) {
  const clamped = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      <div className="relative pt-8">
        <div
          className="absolute top-[-18px] transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{ left: `${clamped}%`, transform: "translateX(-50%)" }}
        >
          <div className="relative rounded-md bg-brand-red px-3 py-2 text-sm font-semibold text-white shadow-lg">
            {Math.round(clamped)}%
            <div
              className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-[5px] border-r-[5px] border-l-[5px] border-t-brand-red border-r-transparent border-l-transparent"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="relative h-0.5 w-full rounded-full bg-white/80">
          <div
            className="progress-stripes absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-full shadow-sm transition-all duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}
