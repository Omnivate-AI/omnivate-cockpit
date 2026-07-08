import { Inbox, ExternalLink, Linkedin, FileText, Video } from "lucide-react"
import { getClientInterestedLeads } from "@/lib/queries/interested-leads"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"

interface InterestedLeadsTabProps {
  clientSlug: string
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return "—"
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// The Smartlead conversation deep-link the trackers use ("Smartlead URL").
function smartleadUrl(leadId: string | null): string | null {
  return leadId ? `https://app.smartlead.ai/app/master-inbox?leadMap=${leadId}` : null
}

export async function InterestedLeadsTab({ clientSlug }: InterestedLeadsTabProps) {
  const leads = await getClientInterestedLeads(clientSlug)

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No Interested Leads Yet"
        description="Positive email replies will appear here automatically as the performance plugin categorises them."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            {leads.length} interested {leads.length === 1 ? "lead" : "leads"}
          </span>
        </div>
        <SectionFreshness mode="db" prefix="Interested replies" />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Industry</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Converted</th>
              <th className="px-4 py-3 font-medium">Links</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => {
              const slUrl = smartleadUrl(l.smartlead_lead_id)
              return (
                <tr key={`${l.replier_email}-${i}`} className="border-b last:border-0 align-top">
                  {/* Lead: name + title, falling back to the reply email */}
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.full_name ?? l.replier_email}</div>
                    {l.title && <div className="text-xs text-muted-foreground">{l.title}</div>}
                    {l.linkedin_url && (
                      <a
                        href={l.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <Linkedin className="h-3 w-3" /> Profile
                      </a>
                    )}
                  </td>

                  {/* Company + website / company LinkedIn */}
                  <td className="px-4 py-3">
                    <div>{l.company_name ?? "—"}</div>
                    <div className="mt-0.5 flex flex-wrap gap-2">
                      {l.website && (
                        <a
                          href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <ExternalLink className="h-3 w-3" /> Site
                        </a>
                      )}
                      {l.company_linkedin_url && (
                        <a
                          href={l.company_linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Linkedin className="h-3 w-3" /> Company
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Contact: email + phone */}
                  <td className="px-4 py-3">
                    <a href={`mailto:${l.replier_email}`} className="text-blue-600 hover:underline dark:text-blue-400">
                      {l.replier_email}
                    </a>
                    {l.phone && <div className="text-xs text-muted-foreground">{l.phone}</div>}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">{l.industry ?? "—"}</td>

                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(l.date_converted)}</td>

                  {/* Links: Smartlead conversation + lead assets (where we have them) */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {slUrl && (
                        <a
                          href={slUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <ExternalLink className="h-3 w-3" /> Conversation
                        </a>
                      )}
                      {l.call_brief_pdf_url && (
                        <a
                          href={l.call_brief_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <FileText className="h-3 w-3" /> Brief
                        </a>
                      )}
                      {l.sendspark_video_url && (
                        <a
                          href={l.sendspark_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Video className="h-3 w-3" /> Video
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
