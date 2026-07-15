import { Sidebar } from "@/components/Sidebar";

export default function AnalysesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Sidebar>{children}</Sidebar>;
}
