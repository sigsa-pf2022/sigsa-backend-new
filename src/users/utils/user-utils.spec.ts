import { normalizeEmail } from './normalize-email';
import { random } from './random-number';

describe('normalizeEmail', () => {
  it('recorta espacios y pasa a minúsculas', () => {
    expect(normalizeEmail('  Pedro@Mail.COM ')).toBe('pedro@mail.com');
  });

  it('tolera vacíos', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

describe('random (códigos de verificación)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('siempre devuelve 6 dígitos', () => {
    for (let i = 0; i < 200; i++) {
      expect(String(random())).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it('si sale un número de menos de 6 dígitos, vuelve a sortear', () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(0.5);
    expect(String(random())).toMatch(/^\d{6}$/);
  });
});
