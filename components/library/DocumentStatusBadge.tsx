import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  uploaded: "secondary",
  processing: "outline",
  ready: "default",
  error: "destructive",
};

export function DocumentStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANT[status] ?? "secondary"}>{status}</Badge>;
}
