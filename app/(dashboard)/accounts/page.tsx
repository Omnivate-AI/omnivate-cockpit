import { redirect } from "next/navigation"

interface AccountsPageProps {
  searchParams: Promise<{ client?: string }>
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const { client } = await searchParams

  if (client) {
    redirect(`/clients/${client}?tab=mailboxes`)
  }

  redirect("/")
}
