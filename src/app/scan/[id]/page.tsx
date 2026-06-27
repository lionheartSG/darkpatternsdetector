import { notFound } from "next/navigation";
import { getScan } from "@/app/actions/scan/getScan";
import { ScanReport } from "@/components/scan/ScanReport";

export const maxDuration = 60;

type ScanPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScanPage({ params }: ScanPageProps) {
  const { id } = await params;
  const result = await getScan(id);

  if (!result.ok) {
    notFound();
  }

  if (result.scan.status === "FAILED") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-2xl font-bold text-foreground">Scan failed</h1>
          <p className="mt-2 text-secondary">
            {result.scan.errorMessage ??
              "We could not analyze this website. Check the URL and try again."}
          </p>
        </div>
      </div>
    );
  }

  if (result.scan.status !== "COMPLETED") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-secondary">
          This scan is still processing. Refresh in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <ScanReport scan={result.scan} />
    </div>
  );
}
