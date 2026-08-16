import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * يحدّ حجم حقل JSON حرّ (كائن/مصفوفة) لمنع هجمات الحمل الكبير (DoS) عند غياب مخطط ثابت.
 */
export function MaxJsonSize(max: number, options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [max],
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) {
            return true;
          }
          try {
            return JSON.stringify(value).length <= max;
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return `الحقل كبير جدًا (الحد ${max} حرفًا بصيغة JSON)`;
        },
      },
    });
  };
}
