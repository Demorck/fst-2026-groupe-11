import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { Role } from '../../generated/prisma/enums.js';

const dto = {
  email: 'a@b.fr',
  name: 'Alice',
  password: 'secret-pass',
  role: Role.ORGANIZER,
};

const signAsync = vi.fn().mockResolvedValue('token');

async function build(prisma: object) {
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: { user: prisma } },
      { provide: JwtService, useValue: { signAsync } },
    ],
  }).compile();
  return module.get(AuthService);
}

describe('AuthService', () => {
  it('stores an argon2 hash, never the plain password', async () => {
    const create = vi.fn().mockResolvedValue({ id: '1' });
    await (await build({ create })).register(dto);

    const { data, select } = create.mock.calls[0][0];
    expect(data.password).toBeUndefined();
    expect(await argon2.verify(data.passwordHash, dto.password)).toBe(true);
    expect(select.passwordHash).toBeUndefined();
  });

  it('throws 409 when the email is already used', async () => {
    const create = vi.fn().mockRejectedValue({ code: 'P2002' });
    await expect(
      (await build({ create })).register(dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('login', () => {
    const credentials = { email: dto.email, password: dto.password };

    it('returns a token carrying the user id and role', async () => {
      const passwordHash = await argon2.hash(dto.password);
      const findUnique = vi
        .fn()
        .mockResolvedValue({ id: 'u1', role: Role.ORGANIZER, passwordHash });

      const result = await (await build({ findUnique })).login(credentials);

      expect(result).toEqual({ accessToken: 'token' });
      expect(signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        role: Role.ORGANIZER,
      });
    });

    it('throws 401 for an unknown email', async () => {
      const findUnique = vi.fn().mockResolvedValue(null);
      await expect(
        (await build({ findUnique })).login(credentials),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 for a wrong password', async () => {
      const passwordHash = await argon2.hash('other-password');
      const findUnique = vi.fn().mockResolvedValue({ passwordHash });
      await expect(
        (await build({ findUnique })).login(credentials),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
