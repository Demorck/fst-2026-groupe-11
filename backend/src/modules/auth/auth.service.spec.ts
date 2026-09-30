import { ConflictException } from '@nestjs/common';
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

async function build(create: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: { user: { create } } },
    ],
  }).compile();
  return module.get(AuthService);
}

describe('AuthService', () => {
  it('stores an argon2 hash, never the plain password', async () => {
    const create = vi.fn().mockResolvedValue({ id: '1' });
    await (await build(create)).register(dto);

    const { data, select } = create.mock.calls[0][0];
    expect(data.password).toBeUndefined();
    expect(await argon2.verify(data.passwordHash, dto.password)).toBe(true);
    expect(select.passwordHash).toBeUndefined();
  });

  it('throws 409 when the email is already used', async () => {
    const create = vi.fn().mockRejectedValue({ code: 'P2002' });
    await expect((await build(create)).register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
