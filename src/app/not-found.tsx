import type { Metadata } from "next";
import { CoreDump } from "@/components/core-dump";
import { DagBackground } from "@/components/dag-background";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "segfault · zach lefin",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-20">
      <DagBackground variant="crashed" />
      <CoreDump />
      <Footer />
    </div>
  );
}
