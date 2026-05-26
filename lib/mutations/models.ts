import { prisma } from '@/lib/db';

type ModelDef = {
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  revalidate: string;
};

export const models: Record<string, ModelDef> = {
  site: {
    update: (_id, data) => prisma.siteSettings.update({ where: { id: 1 }, data }),
    revalidate: '/',
  },
  genre: {
    update: (id, data) => prisma.genre.update({ where: { id }, data }),
    revalidate: '/',
  },
  product: {
    update: (id, data) => prisma.product.update({ where: { id }, data }),
    revalidate: '/',
  },
};
