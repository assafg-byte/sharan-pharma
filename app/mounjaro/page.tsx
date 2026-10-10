export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/** Mounjaro platform entry — the former root: login, then the role's dashboard. */
export default async function MounjaroEntry() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "MANAGER") redirect("/manager");
  redirect("/employee");
}
