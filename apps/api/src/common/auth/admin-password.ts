import { ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * The "admin code": the signed-in user's own password, asked again before a
 * sensitive change (ending a trip by hand, changing a price, correcting an
 * invoice). Throws a 403 when it is missing or wrong.
 */
export async function requireAdminPassword(
  prisma: PrismaService,
  userId: string,
  password: string | undefined,
): Promise<void> {
  const account = password
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      })
    : null;
  if (!account || !(await argon2.verify(account.passwordHash, password!))) {
    throw new ForbiddenException(
      password ? 'Wrong password.' : 'Enter your admin code to continue.',
    );
  }
}
