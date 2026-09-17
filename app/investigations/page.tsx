import AppShell from "@/components/AppShell";
import InvestigationsClient from "./InvestigationsClient";

export default function InvestigationsPage() {
  return (
    <AppShell pageTitle="Investigations" pageEyebrow="Weekly cross-checks">
      <InvestigationsClient />
    </AppShell>
  );
}
