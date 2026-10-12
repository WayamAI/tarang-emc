import { Suspense } from "react";

import { Workspace } from "@/components/tarang/workspace";

export default async function WorkspacePage({ params }: PageProps<"/workspace/[designId]">) {
  const { designId } = await params;
  return (
    <Suspense>
      <Workspace designId={designId} />
    </Suspense>
  );
}
