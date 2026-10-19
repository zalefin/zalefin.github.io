import type { Metadata } from "next";
import { CoreDump } from "@/components/core-dump";
import { DagBackground } from "@/components/dag-background";
import { Footer } from "@/components/footer";
import { DEFAULT_GRAPH } from "@/dag/generated";

export const metadata: Metadata = {
  title: "segfault · zach lefin",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DagBackground graph={DEFAULT_GRAPH} variant="crashed" />
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <CoreDump />
      </div>
      <Footer />
    </div>
  );
}
