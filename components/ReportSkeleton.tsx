import React from 'react';

/**
 * Skeleton loading placeholder for the report area.
 * Mimics the Audit Execution Report layout (tabs, summary bar, content blocks) with shimmer effect.
 */
export const ReportSkeleton: React.FC = () => (
  <div className="bg-white rounded shadow-sm border border-gray-200 mb-10 overflow-hidden">
    {/* Header */}
    <div className="px-8 pt-6 pb-4 border-b border-gray-200">
      <div className="h-7 w-64 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="py-3 px-4 rounded bg-gray-100 flex flex-wrap gap-6 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="flex space-x-1 overflow-x-auto gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded animate-pulse shrink-0" />
        ))}
      </div>
    </div>

    {/* Content area with shimmer overlay */}
    <div className="p-10 bg-[#FAFAFA] min-h-[500px] relative overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="space-y-8 relative">
        {/* Section header */}
        <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
          <div className="border-b-2 border-gray-200 pb-3 mb-6">
            <div className="h-5 w-56 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 bg-gray-50 border border-gray-100 rounded">
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex gap-4 border-b border-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
              ))}
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div key={row} className="px-4 py-3 flex gap-4 border-b border-gray-100 last:border-0">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded animate-pulse flex-1" style={{ animationDelay: `${row * 50}ms` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
