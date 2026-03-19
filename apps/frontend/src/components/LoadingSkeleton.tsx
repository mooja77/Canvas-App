export function PageSkeleton() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md px-4 space-y-4">
        <div className="skeleton h-8 w-48 mx-auto" />
        <div className="skeleton h-4 w-64 mx-auto" />
        <div className="space-y-3 mt-8">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-10 w-32 mx-auto" />
        </div>
      </div>
    </div>
  );
}
