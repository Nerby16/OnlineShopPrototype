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
    name: "Sillón Lino 01",
    slug: "sillon-lino-01",
    category: "Casa",
    description: "Roble macizo y lino lavado en un asiento de líneas tranquilas.",
    price: 289,
    stock: 8,
    image: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 2,
    name: "Cerámica Aura",
    slug: "ceramica-aura",
    category: "Casa",
    description: "Pieza torneada a mano con un esmalte mate de tacto mineral.",
    price: 49,
    stock: 16,
    image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 3,
    name: "Bolso Senda",
    slug: "bolso-senda",
    category: "Accesorios",
    description: "Lona resistente y piel vegetal para acompañarte cada día.",
    price: 119,
    stock: 11,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 4,
    name: "Reloj Nodo",
    slug: "reloj-nodo",
    category: "Accesorios",
    description: "Esfera limpia, caja de acero y correa de piel curtida.",
    price: 149,
    stock: 6,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
  {
    id: 5,
    name: "Zapatilla Alba",
    slug: "zapatilla-alba",
    category: "Accesorios",
    description: "Una silueta ligera en piel suave y suela de caucho natural.",
    price: 94,
    stock: 14,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
  {
    id: 6,
    name: "Lámpara Orbital",
    slug: "lampara-orbital",
    category: "Casa",
    description: "Luz cálida y volumen escultórico para espacios serenos.",
    price: 179,
    stock: 5,
    image: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
];

export const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
