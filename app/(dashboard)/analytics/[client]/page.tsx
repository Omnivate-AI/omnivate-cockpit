import { redirect } from "next/navigation"

export default async function ClientAnalyticsPage({
  params,
}: {
  params: Promise<{ client: string }>
}) {
  const { client } = await params

  redirect(`/clients/${client}?tab=campaigns`)
}
