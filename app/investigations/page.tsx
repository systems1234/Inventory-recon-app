import Navbar from "@/components/Navbar";
import InvestigationsClient from "./InvestigationsClient";

export default function InvestigationsPage() {
  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 min-h-0 max-w-[1600px] mx-auto px-4 sm:px-6 py-4 w-full flex flex-col overflow-hidden">
        <InvestigationsClient />
      </div>
    </main>
  );
}
