export type Product = {
  id: number;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  featured: boolean;
  active?: boolean;
};

export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Frisbee Guayaba",
    slug: "frisbee-guayaba",
    category: "Perros",
    description: "Disco flexible y ligero para vuelos largos, saltos épicos y aterrizajes suaves.",
    price: 16,
    stock: 24,
    image: "https://images.unsplash.com/photo-1604182965221-88b1bc9897ed?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 2,
    name: "Caña Tucán",
    slug: "cana-tucan",
    category: "Gatos",
    description: "Plumas, cintas y movimiento impredecible para despertar al cazador de salón.",
    price: 14,
    stock: 18,
    image: "https://images.unsplash.com/photo-1611279976163-acf6a363e73a?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 3,
    name: "Pelota Coco Loco",
    slug: "pelota-coco-loco",
    category: "Perros",
    description: "Rebote irregular, textura resistente y el tamaño perfecto para perseguir sin descanso.",
    price: 12,
    stock: 30,
    image: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 4,
    name: "Ratón Maracuyá",
    slug: "raton-maracuya",
    category: "Gatos",
    description: "Peluche ligero con cascabel suave para carreras nocturnas y emboscadas felinas.",
    price: 9,
    stock: 26,
    image: "https://images.unsplash.com/photo-1708979346051-e809d2059b32?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
  {
    id: 5,
    name: "Mordedor Piña Pop",
    slug: "mordedor-pina-pop",
    category: "Perros",
    description: "Relieves que masajean las encías y caucho natural preparado para mandíbulas curiosas.",
    price: 18,
    stock: 20,
    image: "https://images.unsplash.com/photo-1560160951-fc67dc9fd4f3?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
  {
    id: 6,
    name: "Túnel Monstera",
    slug: "tunel-monstera",
    category: "Gatos",
    description: "Refugio plegable con ventanas para acechar, esconderse y aparecer por sorpresa.",
    price: 29,
    stock: 12,
    image: "https://images.unsplash.com/photo-1529778873920-4da4926a72c2?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
];

export const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
