import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from './prisma.js';
import { sha256 } from '../utils/hashing.js';

/**
 * Hand an account whose email address was never verified to the person who has
 * just PROVEN they own that address (a Google ID token with email_verified).
 *
 * Why this exists. Anyone can sign up with any address; until the address is
 * verified, nothing proves the person who chose the password owns the inbox.
 * The Google path used to find such an account by email, mark it verified and
 * log the Google user in. If the password account was created by someone else
 * (an "account pre-claim"), both people then shared one account: the attacker
 * kept their cookie session and their password, and read everything the real
 * owner put in afterwards.
 *
 * Design. The research content is kept: in the common, innocent case the
 * password account belongs to the same person, who signed up and never clicked
 * the link, and deleting their work would be the worse failure. What is removed
 * is every way the unproven party could keep getting in or keep receiving data:
 *
 *  - every session issued so far (sessionsInvalidAt; also enforced on the legacy
 *    access-code JWT path in middleware/auth.ts);
 *  - the password, and any outstanding reset or verification token, so the only
 *    way back to a password is a reset link sent to the verified inbox;
 *  - the account's access code (DashboardAccess), which is a second credential.
 *    A legacy code-holder who linked someone else's address keeps nothing;
 *  - collaborator grants and share links on canvases this account owns, and the
 *    other members of teams it owns (a second account of the attacker's would
 *    otherwise keep reading those canvases);
 *  - a bring-your-own AI key, which would send the owner's transcripts to an
 *    AI provider account the unproven party controls.
 *
 * Unverified accounts are on Free without the trial overlay, and Free allows no
 * collaborators or share links, so in the innocent case those grants can only
 * exist if the account paid. The cost of revoking them is a re-invite; the cost
 * of keeping them is a stranger reading someone's interviews.
 */
export interface AccountClaimResult {
  sessionsInvalidAt: Date;
  hadPassword: boolean;
  accessCodeRotated: boolean;
  collaboratorsRevoked: number;
  sharesRevoked: number;
  teamMembersRevoked: number;
  aiKeyRemoved: boolean;
}

/**
 * Thrown (and the whole claim rolled back) when `consumeVerificationTokenHash`
 * was given and that token is no longer on the account: it was already used,
 * replaced by a newer link, or the address was verified in the meantime.
 */
export class VerificationTokenAlreadyUsedError extends Error {
  constructor() {
    super('Verification token already used');
    this.name = 'VerificationTokenAlreadyUsedError';
  }
}

/**
 * Run inside the caller's decision point, before the new session is signed.
 * `freshAccessCode` is minted by the caller (bcrypt runs outside the
 * transaction; see mintAccessCodeCredential in userAuthRoutes.ts).
 *
 * `opts.consumeVerificationTokenHash`: the email-confirmation page claims the
 * account on the strength of a verification link. The link must be single-use,
 * so the claim first consumes exactly that token (compare-and-set inside the
 * same transaction). Two concurrent submissions of one link cannot both act.
 */
export async function claimUnverifiedAccount(
  user: { id: string; passwordHash: string },
  freshAccessCode: { sha256Index: string; bcryptHash: string },
  lifecycleCohortStartedAt: Date | null,
  opts: { consumeVerificationTokenHash?: string } = {},
): Promise<{ user: Awaited<ReturnType<typeof prisma.user.update>>; result: AccountClaimResult }> {
  // Every token issued before this instant is rejected (tokens carry a
  // millisecond issue time, utils/jwt.ts tokenIssuedAtMs); the session the
  // caller signs straight after this is issued later and stays valid.
  const sessionsInvalidAt = new Date();
  const ownedCanvas = {
    OR: [{ userId: user.id }, { dashboardAccess: { is: { userId: user.id } } }],
  };

  const out = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (opts.consumeVerificationTokenHash !== undefined) {
      const consumed = await tx.user.updateMany({
        where: { id: user.id, emailVerified: false, verificationTokenHash: opts.consumeVerificationTokenHash },
        data: { verificationTokenHash: null, verificationTokenExpiry: null },
      });
      if (consumed.count !== 1) throw new VerificationTokenAlreadyUsedError();
    }
    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        passwordHash: '',
        resetTokenHash: null,
        resetTokenExpiry: null,
        verificationTokenHash: null,
        verificationTokenExpiry: null,
        sessionsInvalidAt,
        lifecycleCohortStartedAt,
      },
    });
    const rotated = await tx.dashboardAccess.updateMany({
      where: { userId: user.id },
      data: { accessCode: freshAccessCode.sha256Index, accessCodeHash: freshAccessCode.bcryptHash },
    });
    const collaborators = await tx.canvasCollaborator.deleteMany({
      where: { canvas: ownedCanvas, userId: { not: user.id } },
    });
    const shares = await tx.canvasShare.deleteMany({ where: { canvas: ownedCanvas } });
    const members = await tx.teamMember.deleteMany({
      where: { team: { ownerId: user.id }, userId: { not: user.id } },
    });
    const aiKeys = await tx.userAiConfig.deleteMany({ where: { userId: user.id } });
    return {
      updated,
      result: {
        sessionsInvalidAt,
        hadPassword: user.passwordHash !== '',
        accessCodeRotated: rotated.count > 0,
        collaboratorsRevoked: collaborators.count,
        sharesRevoked: shares.count,
        teamMembersRevoked: members.count,
        aiKeyRemoved: aiKeys.count > 0,
      },
    };
  });

  return { user: out.updated, result: out.result };
}

/**
 * A replacement access code for claimUnverifiedAccount, in the same format as
 * the one minted at sign-up (userAuthRoutes.ts mintAccessCodeCredential). Call
 * it BEFORE the claim: bcrypt must not run inside the transaction.
 */
export async function mintReplacementAccessCode(): Promise<{ sha256Index: string; bcryptHash: string }> {
  const accessCode = `USR-${nanoid(12)}`;
  return { sha256Index: sha256(accessCode), bcryptHash: await bcrypt.hash(accessCode, 12) };
}
