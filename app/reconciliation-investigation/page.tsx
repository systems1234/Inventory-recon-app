import AppShell from "@/components/AppShell";
import ReconciliationClient from "./ReconciliationClient";

export default function ReconciliationInvestigationPage() {
  return (
    <AppShell pageTitle="Reconciliation Investigation" pageEyebrow="IMS vs Recon mismatches">
      <ReconciliationClient />
    </AppShell>
  );
}
