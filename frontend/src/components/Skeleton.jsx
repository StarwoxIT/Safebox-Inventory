export function SkeletonRows({ rows = 5, columns = 4 }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          {Array.from({ length: columns }).map((__, j) => (
            <div className="skeleton skeleton-cell" key={j} />
          ))}
        </div>
      ))}
    </div>
  );
}
