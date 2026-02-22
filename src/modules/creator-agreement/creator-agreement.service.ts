import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CREATOR_AGREEMENT_TEXT, CREATOR_AGREEMENT_VERSION } from './creator-agreement.const';

@Injectable()
export class CreatorAgreementService {
  constructor(private prisma: PrismaService) {}

  private async getCreatorStatus(userId: string): Promise<string> {
    try {
      const profiles: any[] = await this.prisma.$queryRawUnsafe(
        'SELECT status FROM CreatorProfile WHERE userId = ? LIMIT 1',
        userId,
      );
      if (profiles && profiles.length > 0) {
        return String(profiles[0].status || '').toLowerCase();
      }
    } catch (e) {}
    return 'none';
  }

  async getStatus(userId: string) {
    const creatorStatus = await this.getCreatorStatus(userId);
    const eligible = creatorStatus === 'approved';
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        creatorAgreementAcceptedAt: true,
        creatorAgreementVersion: true,
      },
    });

    const accepted = !!(user && user.creatorAgreementAcceptedAt);
    const version = user?.creatorAgreementVersion || null;
    const needResign = eligible ? (!accepted || version !== CREATOR_AGREEMENT_VERSION) : false;

    return {
      eligible,
      accepted,
      version,
      currentVersion: CREATOR_AGREEMENT_VERSION,
      needResign,
      text: CREATOR_AGREEMENT_TEXT,
    };
  }

  async accept(userId: string, ip: string, userAgent: string) {
    const creatorStatus = await this.getCreatorStatus(userId);
    if (creatorStatus !== 'approved') {
      throw new ForbiddenException('creator_not_eligible');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        creatorAgreementAcceptedAt: new Date(),
        creatorAgreementVersion: CREATOR_AGREEMENT_VERSION,
        creatorAgreementIp: ip || null,
        creatorAgreementUserAgent: userAgent || null,
        creatorAgreementSnapshot: CREATOR_AGREEMENT_TEXT,
      },
    });

    return this.getStatus(userId);
  }
}
