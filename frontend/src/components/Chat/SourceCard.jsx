/**
 * SourceCard — displays a single legal document source citation.
 *
 * Source shape (from backend):
 * {
 *   title: string,       // document name
 *   page: number|null,   // page number if available
 *   excerpt: string,     // chunk text
 *   score: number,       // relevance score 0–1
 * }
 */
export default function SourceCard({ source }) {
  const { title, page, excerpt, score } = source;

  // Truncate excerpt to 150 characters
  const truncatedExcerpt =
    excerpt && excerpt.length > 150 ? excerpt.slice(0, 150).trimEnd() + '…' : excerpt;

  // Score badge color
  let badgeColor = 'bg-red-900/60 text-red-300 border-red-700/40';
  let badgeLabel = 'Low';
  if (score >= 0.8) {
    badgeColor = 'bg-emerald-900/60 text-emerald-300 border-emerald-700/40';
    badgeLabel = 'High';
  } else if (score >= 0.6) {
    badgeColor = 'bg-amber-900/60 text-amber-300 border-amber-700/40';
    badgeLabel = 'Med';
  }

  return (
    <div className="bg-dark-surface/70 rounded-lg p-3 border border-white/5 text-xs space-y-1">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-200 truncate leading-snug" title={title}>
          {title || 'Unknown Document'}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {page != null && (
            <span className="text-slate-400 whitespace-nowrap">p.{page}</span>
          )}
          {score != null && (
            <span
              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${badgeColor}`}
            >
              {badgeLabel} {Math.round(score * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Excerpt */}
      {truncatedExcerpt && (
        <p className="text-slate-400 leading-relaxed">{truncatedExcerpt}</p>
      )}
    </div>
  );
}
