import { Paginated } from '../interfaces';

export function skipTake(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
  };
}
