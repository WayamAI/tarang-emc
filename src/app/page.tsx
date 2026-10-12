import { redirect } from "next/navigation";

import { APP } from "@/lib/app";

export default function Home() {
  redirect(APP.home);
}
