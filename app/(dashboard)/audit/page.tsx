import { getAuditLog, type AuditLogFilters } from "@/lib/queries"
import { AuditFilters } from "@/components/audit/audit-filters"
import { AuditTable } from "@/components/audit/audit-table"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { CsvExport } from "@/components/audit/csv-export"
import { Pagination } from "@/components/shared/pagination"

const PAGE_SIZE = 25

interface AuditPageProps {
  searchParams: Promise<{
    action?: string
    client?: string
    status?: string
    range?: string
    page?: string
  }>
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams

  const filters: AuditLogFilters = {
    actionType: params.action || null,
    client: params.client || null,
    status: params.status || null,
    dateRange: (params.range as AuditLogFilters["dateRange"]) ?? null,
    page: params.page ? Number(params.page) : 1,
    pageSize: PAGE_SIZE,
  }

  const { actions, totalCount } = await getAuditLog(filters)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track all domain actions and operations
          </p>
          <SectionFreshness
            mode="db"
            prefix="Live action log"
            className="mt-1.5"
          />
        </div>
        <CsvExport />
      </div>

      {/* Filters */}
      <AuditFilters />

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {totalCount} action{totalCount !== 1 ? "s" : ""} found
      </p>

      {/* Audit Table */}
      <AuditTable actions={actions} />

      {/* Pagination */}
      <Pagination
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/audit"
      />
    </div>
  )
}
