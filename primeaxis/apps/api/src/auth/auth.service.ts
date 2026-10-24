import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Registration creates the user AND their first farm (as OWNER). */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash: await argon2.hash(dto.password),
        fullName: dto.fullName,
        memberships: {
          create: {
            role: 'OWNER',
            farm: {
              create: {
                name: dto.farmName,
                subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
              },
            },
          },
        },
      },
    });
    return this.issueTokens(user.id, user.email, user.isPlatformAdmin);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    // Same error for unknown email and bad password — no account probing.
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user.id, user.email, user.isPlatformAdmin);
  }

  /** Rotating refresh: the presented token is revoked, a new one issued. */
  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(row.user.id, row.user.email, row.user.isPlatformAdmin);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string, adm: boolean) {
    const accessToken = await this.jwt.signAsync({ sub: userId, email, adm });

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: sha256(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });

    const memberships = await this.prisma.farmMember.findMany({
      where: { userId },
      include: { farm: { select: { id: true, name: true } } },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email },
      farms: memberships.map((m) => ({ ...m.farm, role: m.role })),
    };
  }
}
