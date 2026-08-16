import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../../src/modules/auth/dto/register.dto';
import { CreateProductDto } from '../../src/modules/products/dto/create-product.dto';

async function errorsFor<T extends object>(cls: new () => T, payload: unknown): Promise<string[]> {
  const dto = plainToInstance(cls, payload);
  const errors = await validate(dto as object, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe('Input validation (Malicious / oversized input)', () => {
  it('rejects weak passwords, oversized names, and invalid emails on register', async () => {
    expect(await errorsFor(RegisterDto, { storeName: 'S', name: 'N', email: 'x@y.z', password: 'onlyletters' })).toContain('password');
    expect(await errorsFor(RegisterDto, { storeName: 'S', name: 'N', email: 'x@y.z', password: 'short1' })).toContain('password');
    expect(await errorsFor(RegisterDto, { storeName: 'S', name: 'x'.repeat(200), email: 'x@y.z', password: 'Passw0rd1' })).toContain('name');
    expect(await errorsFor(RegisterDto, { storeName: 'S', name: 'N', email: 'not-an-email', password: 'Passw0rd1' })).toContain('email');
  });

  it('accepts a strong, well-formed registration', async () => {
    expect(await errorsFor(RegisterDto, { storeName: 'Store', name: 'Owner', email: 'owner@store.test', password: 'Passw0rd1' })).toEqual([]);
  });

  it('bounds product free-text and arrays (XSS/DoS surface)', async () => {
    // وصف ضخم يتجاوز 5000 حرف
    expect(await errorsFor(CreateProductDto, { name: 'P', price: 10, description: 'a'.repeat(6000) })).toContain('description');
    // عدد وسوم مفرط (> 30)
    const tags = Array.from({ length: 40 }, (_, i) => 't' + i);
    expect(await errorsFor(CreateProductDto, { name: 'P', price: 10, tags })).toContain('tags');
    // imageUrl ليس رابطًا صالحًا
    expect(await errorsFor(CreateProductDto, { name: 'P', price: 10, imageUrl: 'javascript:alert(1)' })).toContain('imageUrl');
    // كائن attributes ضخم جدًا (MaxJsonSize)
    const huge: Record<string, string> = {};
    for (let i = 0; i < 500; i++) huge['k' + i] = 'v'.repeat(50);
    expect(await errorsFor(CreateProductDto, { name: 'P', price: 10, attributes: huge })).toContain('attributes');
  });

  it('rejects unknown/injected extra fields (forbidNonWhitelisted)', async () => {
    const props = await errorsFor(CreateProductDto, { name: 'P', price: 10, isAdmin: true, __proto__: {} });
    expect(props).toContain('isAdmin');
  });

  it('treats SQL-ish strings as plain data (Prisma parameterizes — no injection)', async () => {
    // اسم يحتوي رموز SQL يُقبل كنص عادي؛ Prisma يمرّره كمعامل مُعزَّل، فلا حقن.
    const props = await errorsFor(CreateProductDto, { name: "Robe'; DROP TABLE products;--", price: 10 });
    expect(props).not.toContain('name');
  });
});
