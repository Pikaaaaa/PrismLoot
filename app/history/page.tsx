import { redirect } from "next/navigation";

export default function HistoryRedirect() {
  redirect("/profile?tab=activity");
}
