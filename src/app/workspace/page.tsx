import { redirect } from "next/navigation";

import { DEFAULT_DESIGN_ID } from "@/lib/tarang/designs";

export default function WorkspaceIndex() {
  redirect(`/workspace/${DEFAULT_DESIGN_ID}`);
}
