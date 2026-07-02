import { redirect } from "next/navigation"

interface DomainsPageProps {
  searchParams: Promise<{ client?: string }>
}

export default async function DomainsPage({ searchParams }: DomainsPageProps) {
  const { client } = await searchParams

  if (client) {
    redirect(`/clients/${client}?tab=mailboxes`)
  }

  redirect("/")
}
