// How-did-you-hear-about-us (HDYHAU): canonical channel keys shared with the
// JMS Command Centre, and the forwarder for the one `hdyhau` event per account.
//
// QualCanvas is not a Shopify app, so `shopify_app_store` is deliberately not a
// key here. The Command Centre stores whatever string it receives, so THIS list
// is the whitelist: anything else is rejected before it is persisted or sent.

import { trackJmsEvent } from './jms-events.js';
import { isTestAccountEmail } from '../utils/testAccounts.js';

export const HDYHAU_CHANNELS = ['ai_assistant', 'google', 'word_of_mouth', 'trade_group', 'social', 'other'] as const;

export type HdyhauChannel = (typeof HDYHAU_CHANNELS)[number];

export const HDYHAU_OTHER_TEXT_MAX = 500;

export function isHdyhauChannel(value: unknown): value is HdyhauChannel {
  return typeof value === 'string' && (HDYHAU_CHANNELS as readonly string[]).includes(value);
}

/**
 * Only accounts created on or after this instant are asked. The question is
 * meant for the moment right after signup; asking researchers who joined months
 * ago would mix recall into the attribution data.
 */
export const HDYHAU_ASK_ACCOUNTS_CREATED_FROM = new Date('2026-09-27T00:00:00.000Z');

/**
 * Forward one answer to the Command Centre. `is_test` comes from QualCanvas's
 * own fixture predicate (utils/testAccounts.ts); the ingest also drops test
 * emails server-side. Best-effort: trackJmsEvent never throws and is a no-op
 * when ADMIN_API_KEY is unset.
 */
export async function forwardHdyhau(
  email: string | null | undefined,
  channel: HdyhauChannel,
  freeText?: string | null,
): Promise<void> {
  const properties: Record<string, unknown> = {
    channel,
    is_test: isTestAccountEmail(email),
  };
  if (channel === 'other' && freeText) properties.free_text = freeText;
  await trackJmsEvent({ name: 'hdyhau', email: email ?? undefined, properties });
}
