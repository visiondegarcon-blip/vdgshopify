/* Shared About Us copy + archive, used by the design variants. */

export const TABS = ["What Is VDG", "Brand Mission", "Our Future"] as const;
export type Tab = (typeof TABS)[number];

export const SECTIONS: Record<Tab, { heading: string; body: string }[]> = {
  "What Is VDG": [
    {
      heading: "What Is Vision De Garçon™",
      body: "Vision De Garçon™ (VDG) was created as a humanitarian platform to shine a light on global issues overlooked by mainstream media. A voice for the unspoken, telling their stories through various forms of art, clothing and creative expression.",
    },
    {
      heading: "The Meaning Behind The Name",
      body: "Vision De Garçon, French for The Boy's Vision, was chosen as a testament to all the boys and girls around the world who had the same dreams and visions as us but couldn't get to live them out due to factors like poverty and war.",
    },
  ],
  "Brand Mission": [
    {
      heading: "Clothing is just the beginning",
      body: "Bracelets, paintings, poems, necklaces. Who said art has borders? There are poets who've never shared their words. Painters whose work has never left their room. Musicians who only play for empty streets. Designers with visions bigger than their resources. We're here to change that. This isn't just about selling products, it's about amplifying voices.",
    },
    {
      heading: "Host events",
      body: "Open mics, art exhibitions, candlelight vigils for causes that matter. Document stories, travel, listen, and share the raw, real narratives of people who inspire us.",
    },
    {
      heading: "Collaborate",
      body: "Not compete. Build a network where creators lift each other up. A street artist from Lagos alongside a designer from Tokyo. A poet from Chicago with a musician from Berlin. A small-town jewelry maker with the same exposure as a high-end brand. If your art ever felt too different, or too unknown, this is your sign.",
    },
  ],
  "Our Future": [
    {
      heading: "Our Future",
      body: "Beyond awareness and donating to charities, our main goal is to grow into a platform where people who want to go out to these countries and give aid first-hand can do so. And on these trips, through film and raw storytelling, capture the human experience. The smiles, the struggles, the shared meals, the laughter from late-night fireplace conversations. The stories that remind us: no matter where we're from, we're all living the same story, on the same planet.",
    },
  ],
};

export type ArchiveEntry = {
  img: string;
  title: string;
  place: string;
  fact: string;
  credit: string;
};

export const ARCHIVE: ArchiveEntry[] = [
  {
    img: "/about/Paris_is_Burning.jpg",
    title: "Rire à la Rue",
    place: "Marseille, France",
    fact: "Marseille's housing projects are 80% Arab yet 0% of the city's tourism ads.",
    credit: "Élodie Baptiste, Avocats Sans Frontières France",
  },
  {
    img: "/about/Angola.jpg",
    title: "Salon Lessons",
    place: "Luanda, Angola",
    fact: "In Africa, certain braid patterns were used to hide seeds, show tribal status, or even map routes from slave traders.",
    credit: "Carolina 'Caro' Jiménez, DR",
  },
  {
    img: "/about/ccc18878-7ef1-40f8-8bb7-4adb7873b7ea.jpg",
    title: "Rent Due Mix Vol. 1",
    place: "The Bronx, New York",
    fact: "NYC street performers get ticketed every 53 minutes on average.",
    credit: "Theophilé 'Te Gwap' Habimana",
  },
  {
    img: "/about/richmonddoll.jpg",
    title: "¡Cuatro manos una llama!",
    place: "Caribbean",
    fact: "In the Caribbean favelas the average family cooks on one gas stove and uses 27% less water per meal than Michelin chefs. Efficiency isn't taught here, it's survival.",
    credit: "Photographer unknown",
  },
  {
    img: "/about/6.jpg",
    title: "Water That Costs More Than Water",
    place: "North Africa",
    fact: "The human brain identifies Coca-Cola's silhouette faster than the Nike swoosh. Some cravings don't need translation.",
    credit: "Noor Haddad",
  },
  {
    img: "/about/Baseball_in_Trinidad_-_A_bunch_of_Cuban_kids_playing_baseball_barefoot_down_the_streets.jpg",
    title: "Azúcar, Sudor Y Cambios De Humor",
    place: "Santiago de Cuba",
    fact: "60% of Caribbean pros started playing with taped-up rocks as balls.",
    credit: "Photographer unknown",
  },
  {
    img: "/about/5.jpg",
    title: "Eja. Plantain. Tun ṣe.",
    place: "Lagos to Kingston",
    fact: "The plantain's journey mirrors the black diaspora: enslaved Africans planted shoots in their hair across the Americas. One in three Caribbean meals still begins with its peel.",
    credit: "Adejoké Bakare, Michelin Chef",
  },
  {
    img: "/about/Peruvian_Amazon.jpg",
    title: "Mi Primer Dia",
    place: "Peruvian Amazon",
    fact: "These girls will study three extra years on average compared to their grandmothers.",
    credit: "Photographer unknown",
  },
  {
    img: "/about/mother_and_baby_MRI.jpg",
    title: "A Mothers Love",
    place: "Vienna, Austria",
    fact: "In 85% of cultures worldwide, mothers instinctively kiss their child's forehead exactly where the MRI's warmth appears. A biological reset button for fear.",
    credit: "Dr. Trinh Nguyen, University of Vienna",
  },
  {
    img: "/about/7.jpg",
    title: "Trial At São Paulo",
    place: "São Paulo, Brazil",
    fact: "Rio's favelas produce more pro players than most academies.",
    credit: "Olivera De Ribero, Joga TV Brazil",
  },
  {
    img: "/about/MYTHODEA.jpg",
    title: "اللي يشتيلون البراميل بدال العيال",
    place: "Sudan",
    fact: "Women in Sudan walk 7km daily, the water usually weighing more than their toddlers.",
    credit: "Sameria Abu Salmiya, Al Jazeera",
  },
];
