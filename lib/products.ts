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
    name: "Disco de entrenamiento Terra",
    slug: "disco-entrenamiento-terra",
    category: "Perros",
    description: "Disco flexible de alta visibilidad, diseñado para sesiones de juego y entrenamiento al aire libre.",
    price: 16.9,
    stock: 24,
    image: "https://images.unsplash.com/photo-1604182965221-88b1bc9897ed?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 2,
    name: "Varita de juego Nilo",
    slug: "varita-juego-nilo",
    category: "Gatos",
    description: "Varita ligera con movimiento irregular para favorecer la actividad y la estimulación diaria.",
    price: 14.5,
    stock: 18,
    image: "https://images.unsplash.com/photo-1611279976163-acf6a363e73a?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 3,
    name: "Percha natural Olmo",
    slug: "percha-natural-olmo",
    category: "Aves",
    description: "Percha de madera natural con diámetro variable para favorecer el apoyo y el desgaste de las uñas.",
    price: 22.9,
    stock: 30,
    image: "https://images.unsplash.com/photo-1607798136809-1483b83f32fd?auto=format&fit=crop&w=1000&q=85",
    featured: true,
  },
  {
    id: 4,
    name: "Túnel de heno Prado",
    slug: "tunel-heno-prado",
    category: "Pequeños animales",
    description: "Refugio de fibras vegetales para explorar, descansar y roer de forma segura.",
    price: 13.9,
    stock: 26,
    image: "https://images.unsplash.com/photo-1742094611825-4e4d6493fbfd?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
  {
    id: 5,
    name: "Filtro compacto Aqua 40",
    slug: "filtro-compacto-aqua-40",
    category: "Acuario",
    description: "Sistema de filtración silencioso para acuarios pequeños, con caudal regulable y mantenimiento sencillo.",
    price: 39.9,
    stock: 20,
    image: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=1000&q=85",
    featured: false,
  },
  {
    id: 6,
    name: "Refugio mineral Duna",
    slug: "refugio-mineral-duna",
    category: "Terrario",
    description: "Escondite estable de acabado mineral para crear una zona de descanso protegida en el terrario.",
    price: 27.9,
    stock: 12,
    image: "https://unsplash.com/photos/9CWKfMwIGfo/download?force=true&w=1000",
    featured: false,
  },
];

export const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
