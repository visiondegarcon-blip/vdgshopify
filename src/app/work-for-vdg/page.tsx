import Link from "next/link";
import Header from "@/components/Header";

const JOBS = [
  {
    title: "Journaliste (Ouvert Aux Étudiants / Diplômé) – France 🇫🇷",
    loc: "📍 France",
    meta: "Type: Student-friendly / Independent / Contracted\nCompensation: Paid + Volunteer Options Available",
    body: `À propos de Vision de Garçon (VDG) Vision de Garçon est un mouvement et une marque internationale qui donne une voix aux sans-voix, notamment aux enfants et jeunes issus de pays en guerre, pauvres ou sous-représentés. Fondé pour mettre en lumière des enjeux mondiaux souvent négligés par les médias traditionnels, VDG opère sur plusieurs continents, unissant les individus à travers des récits, la sensibilisation et le plaidoyer. Nous croyons au pouvoir des rêves partagés et de l'action collective pour créer le changement. Description du poste Nous recherchons un(e) journaliste passionné(e) basé(e) en France, partageant notre mission et nos valeurs, pour rejoindre notre équipe en tant qu'indépendant(e), sous contrat ou bénévole. Ce poste est idéal pour les étudiants ou journalistes qualifiés souhaitant constituer un portfolio significatif et acquérir une expérience pratique concrète tout en ayant un impact réel. Vous contribuerez à amplifier des voix rarement entendues en produisant des articles percutants, en menant des interviews et en créant du contenu informatif qui met en lumière des histoires en accord avec la mission de VDG, donner une représentation aux communautés marginalisées et sensibiliser aux défis mondiaux urgents. Nous proposons des modalités flexibles, incluant des missions rémunérées, des contributions bénévoles, ou un mélange des deux.`,
    apply: "https://forms.gle/2WBmww9Lzu6vSvHf7",
  },
  {
    title: "High Retention Video Editor – International 🌎",
    loc: "📍 International",
    meta: "Compensation: Paid Per Project",
    body: `Role: High-Retention Short-Form Video Editor. Style: Clean. Modern. Infographic-Heavy — "Vox" Style. VDG is looking for a pro-level short-form editor to help us bring global impact to life through concise, powerful, story-driven videos. Whether it's turning complex ideas into compelling 60-second content, building TikTok/Instagram reels with clean motion graphics, or translating raw footage into high-retention narrative edits.\n\nPerks: – Paid Per Project – Flexible Remote Work – Global Exposure Across Campaigns – Real-World Portfolio with a Mission-Driven Brand\n\nThis is for editors who: – Know how to make something feel premium without overcomplicating it – Care about storytelling that matters – Want to grow with an international, purpose-led movement`,
    apply: "https://forms.gle/TiY59tnkcwt2bX5P6",
  },
  {
    title: "(Experiente) Assistente de Videomaker / Líder da Equipe de Marketing – Brasil 🇧🇷",
    loc: "📍 Brasil",
    meta: "Tipo: Amigável para estudantes / Qualificados\nCompensação: Pagamento + Opções Voluntárias Disponíveis",
    body: `Estamos procurando pessoas criativas e socialmente conscientes no Brasil para se juntarem à Vision de Garçon (VDG) como parte da nossa equipe local de videomakers ou como líder de marketing e comunidade. Seja você estudante, criativo iniciante ou alguém com experiência em ações de base, essa é uma oportunidade de construir um portfólio real, documentar histórias que importam e fazer parte de uma marca internacional que valoriza verdade, comunidade e cultura. Para os videomakers, não buscamos perfeição técnica. Queremos o cru, o real — cenas das ruas, a alegria e a luta, jogos locais, orgulho cultural, vida na favela, a correria do povo. Arranjos flexíveis disponíveis — isso pode ser um projeto pago, contribuição voluntária ou um mix dos dois.`,
    apply: "https://forms.gle/TiY59tnkcwt2bX5P6",
  },
  {
    title: "(Experienced) Shopify Store Expert – Australia 🇦🇺",
    loc: "📍 Australia",
    meta: "Type: Independent / Freelance / Project-Based\nCompensation: Fully Paid – Per Gig / Project Basis",
    body: `Vision de Garçon (VDG) is looking for an experienced Shopify store expert to assist with the setup, design, and optimisation of our online store as we prepare for upcoming launches. This is a fully paid role on a project-by-project basis, ideal for someone confident in translating brand identity into clean, user-friendly, and high-converting Shopify experiences.\n\nWhat We're Looking For: – Strong experience building and customising Shopify stores – Understanding of UX/UI, clean design, mobile responsiveness – Ability to troubleshoot issues and integrate apps/plugins as needed – Experience with product setup, navigation, checkout optimisation, etc. – Bonus: experience with fashion or mission-based brands`,
    apply: "https://forms.gle/TiY59tnkcwt2bX5P6",
  },
  {
    title: "Brand Marketing Team Leader (Student Friendly / Qualified) – United Kingdom 🇬🇧",
    loc: "📍 UK",
    meta: "Type: Student-friendly / Qualified\nCompensation: Paid + Volunteer Options Available",
    body: `We're looking for a creative and socially-conscious individual based in the UK to join our team as a Social Media & Community Marketer. Whether you're a student, early creative, or qualified professional, this is a chance to build a meaningful portfolio, gain real-world experience, and contribute to a growing international brand that stands for something deeper. In this role, you won't just be posting content — you'll help shape VDG's online and offline presence. From managing social platforms and storytelling campaigns to helping spark real-world community through events like pop-up shops, vigils, and panel nights, you'll be a key voice in creating the vibe around the movement.`,
    apply: "https://forms.gle/TiY59tnkcwt2bX5P6",
  },
  {
    title: "Cinematographic Video Editor – Australia 🇦🇺",
    loc: "📍 Australia (Sydney, Melbourne & Brisbane) Preferred",
    meta: "Type: Independent / Student-friendly\nCompensation: Paid Per Project",
    body: `We're seeking a passionate cinematographic video editor based in Australia to join the VDG creative team for upcoming campaigns, content shoots, and international storytelling projects. Whether you're a student, emerging filmmaker, or established creative, this is a chance to build a meaningful portfolio while contributing to real-world impact. You'll help bring our global vision to life by capturing powerful moments — whether it's local community stories, cinematic brand visuals, or behind-the-scenes work for global campaigns. This is a hybrid role, with both remote collaboration and on-site opportunities.`,
    apply: "https://forms.gle/TiY59tnkcwt2bX5P6",
  },
  {
    title: "Assistant Chef d'Équipe Marketing (Ouvert Aux Étudiants / Diplômé) – Paris 📍",
    loc: "📍 France",
    meta: "Type: Étudiante / Qualifié\nRémunération: Rémunéré + Options de bénévolat disponibles",
    body: `Vision de Garçon (VDG) recherche un·e Assistant·e Marketing basé·e en France pour rejoindre notre équipe actuelle. Que tu sois étudiant·e, créatif·ve en début de parcours ou professionnel·le avec de l'expérience, c'est l'occasion de faire partie d'un mouvement mondial en pleine croissance, tout en construisant un portfolio réel et engagé. Tu seras impliqué·e dans : – La gestion des réseaux sociaux – Le storytelling digital – La mise en place d'événements locaux (pop-ups, panels, vigiles, etc.) – Les interviews de rue et les campagnes culturelles. On cherche quelqu'un qui comprend la vibe des quartiers, qui a un œil pour la culture, et un cœur pour ceux qui n'ont pas toujours eu la parole.`,
    apply: "https://forms.gle/jttvmMTtLBQZKGk68",
  },
];

export default function WorkForVdgPage() {
  return (
    <main className="t-surface min-h-screen">
      <Header showCart={false} />
      <div className="mx-auto max-w-3xl px-4 pb-28">
        <h1 className="text-center font-oswald text-2xl font-bold tracking-widest">WORK FOR VDG</h1>
        <div className="mt-10 flex flex-col gap-12">
          {JOBS.map((j) => (
            <article key={j.title}>
              <h2 className="font-semibold">{j.title}</h2>
              <div className="mt-1 text-sm">{j.loc}</div>
              <div className="mt-1 whitespace-pre-line text-sm text-gray-600">{j.meta}</div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{j.body}</p>
              <a
                href={j.apply}
                target="_blank"
                rel="noopener noreferrer"
                className="t-btn mt-4 inline-block px-6 py-2 text-sm"
              >
                APPLY
              </a>
            </article>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link href="/" className="font-platypi text-sm underline">
            BACK HOME
          </Link>
        </div>
      </div>
    </main>
  );
}
