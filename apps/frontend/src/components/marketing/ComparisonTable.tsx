import { ReactNode } from 'react';

export interface ComparisonGroup {
  /** Group heading shown as a row spanning all columns. */
  heading: string;
  rows: ComparisonRow[];
}

export interface ComparisonRow {
  feature: string;
  /** One entry per column. ReactNode so callers can pass numbers, strings, or icons. */
  values: ReactNode[];
}

interface ComparisonTableProps {
  /** Column headers, including the leading "Feature" column label. */
  columns: ReactNode[];
  groups: ComparisonGroup[];
  className?: string;
}

/**
 * Categorical (not binary) feature comparison table per
 * docs/refresh/06-pages/02-pricing.md §6.2.
 *
 * Replaces the legacy checkmark grid. Cells take numbers or short text
 * ("Unlimited", "50K words", "5") so readers can compare quantities, not
 * just yes/no. Mobile reflow is a stacked variant the caller can swap to.
 */
export default function ComparisonTable({ columns, groups, className = '' }: ComparisonTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${
                  idx === 0 ? 'text-left' : 'text-center'
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Group key={group.heading} group={group} columnCount={columns.length} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Group({ group, columnCount }: { group: ComparisonGroup; columnCount: number }) {
  return (
    <>
      <tr>
        <td
          colSpan={columnCount}
          className="bg-gray-50/60 dark:bg-gray-800/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-y border-gray-200/60 dark:border-gray-800/60"
        >
          {group.heading}
        </td>
      </tr>
      {group.rows.map((row, idx) => (
        <tr key={idx} className="border-b border-gray-100 dark:border-gray-900">
          <td className="py-3 px-4 text-gray-800 dark:text-gray-200 font-medium">{row.feature}</td>
          {row.values.map((value, vidx) => (
            <td key={vidx} className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
              {value}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
