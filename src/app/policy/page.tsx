import Link from "next/link";
import Header from "@/components/Header";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Refund & Returns Policy",
    items: [
      "We offer refunds only for faulty or damaged items, and the request must be submitted within 7 days of delivery.",
      "Items must be unused and in original packaging.",
      "Refunds will be processed via Stripe's refund system back to the original payment method.",
      "Items purchased on sale are not eligible for refunds unless faulty.",
    ],
  },
  {
    title: "Exchange Policy",
    items: [
      "We allow size exchanges only, subject to availability.",
      "Customer is responsible for all return and re-shipping costs.",
      "Items must be returned in their original, unworn condition.",
      "Exchange requests must be made within 7 days of delivery.",
    ],
  },
  {
    title: "Order Cancellation",
    items: [
      "Orders can be canceled or refunded only before they are shipped. Once shipped, orders are final unless the item is faulty.",
    ],
  },
  {
    title: "Shipping Policy",
    items: [
      "All orders ship from Australia via Australia Post.",
      "We ship domestically and internationally to countries supported by Australia Post.",
      "Orders are processed and dispatched within standard processing times unless otherwise stated.",
      "Shipping costs follow Australia Post flat rate guidelines, based on the weight of each order.",
      "Tracking is available for orders where tracking is paid for.",
      "We are not responsible for stolen packages once marked as delivered.",
      "If a package is confirmed lost in transit and the carrier does not issue a refund, we will issue a full refund upon receiving sufficient proof of loss.",
    ],
  },
  {
    title: "Privacy Policy",
    items: [
      "We collect standard personal information (e.g. name, email address, shipping info) to fulfill orders and improve your experience.",
      "This data may be used for marketing (e.g. email newsletters), but is never sold or shared with third parties without consent.",
      "You may unsubscribe from our mailing list at any time.",
    ],
  },
  {
    title: "Intellectual Property & Content",
    items: [
      "All designs, artwork, logos, photos, and content under Vision de Garçon are the intellectual property of Vision de Garçon.",
      "Unauthorized reproduction, redistribution, or commercial use is strictly prohibited and subject to legal action.",
      "All rights reserved.",
    ],
  },
  {
    title: "Terms of Service",
    items: [
      "By using our website or purchasing from Vision de Garçon, you agree to all policies listed here.",
      "We reserve the right to decline or refund any order for any reason, including suspected fraud or behavior inconsistent with our brand values.",
      "We also reserve the right to blacklist any individual or account from future purchases or access to our site, at our sole discretion.",
    ],
  },
];

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header showCart={false} />
      <div className="mx-auto max-w-2xl px-4 pb-28">
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="font-oswald text-lg font-bold">{s.title}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
        <div className="mt-16 text-center">
          <Link href="/" className="font-platypi text-sm underline">
            Back Home
          </Link>
          <div className="mt-4 font-platypi tracking-widest">Rideaux</div>
        </div>
      </div>
    </main>
  );
}
