/**
 * مصنع Prisma وهمي للاختبارات — كل موديل مجموعة دوال jest.fn.
 * $transaction: يدعم الشكلين (دالة callback بتمرير tx=prisma، أو مصفوفة promises).
 */
export type MockModel = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

function model(): MockModel {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;

export function createPrismaMock() {
  const prisma = {
    user: model(),
    merchant: model(),
    product: model(),
    order: model(),
    orderItem: model(),
    stockMovement: model(),
    customer: model(),
    conversation: model(),
    message: model(),
    faq: model(),
    knowledgeEntry: model(),
    plan: model(),
    subscription: model(),
    usageRecord: model(),
    refreshToken: model(),
    notification: model(),
    payment: model(),
    errorLog: model(),
    auditLog: model(),
    telegramBot: model(),
    aiSettings: model(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: jest.fn(),
  };

  // callback(tx) => tx = prisma ذاته ؛ أو مصفوفة => Promise.all
  prisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as Promise<unknown>[]),
  );

  return prisma;
}
