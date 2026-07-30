import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <main className="t-surface min-h-screen">
      <Header />
      <div className="mx-auto max-w-md px-4 pb-28 text-center">
        <h1 className="font-mono text-2xl font-bold">404</h1>
        <p className="mt-3 text-sm">This page slipped through the vision.</p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/store" className="t-btn px-5 py-2 font-mono text-sm">
            Back To Store
          </Link>
          <Link href="/" className="font-mono text-sm underline underline-offset-4">
            Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
