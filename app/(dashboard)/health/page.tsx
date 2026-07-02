import { redirect } from "next/navigation"

interface HealthPageProps {
  searchParams: Promise<{ client?: string }>
}

export default async function HealthPage({ searchParams }: HealthPageProps) {
  const { client } = await searchParams

  if (client) {
    redirect(`/clients/${client}?tab=mailboxes`)
  }

  redirect("/")
}
