/**
 * Maps per-user request headers to an eBay config for one MCP session.
 * Credentials are never read from the Actor's own environment, so one user can
 * never act on another user's (or the Actor owner's) eBay account.
 */

/** Header names accepted on the MCP `initialize` request. */
export const ebayHeaders = {
  clientId: 'x-ebay-client-id',
  clientSecret: 'x-ebay-client-secret',
  refreshToken: 'x-ebay-refresh-token',
  environment: 'x-ebay-environment',
  marketplaceId: 'x-ebay-marketplace-id',
  contentLanguage: 'x-ebay-content-language',
};

const header = (req, name) => {
  const value = req.headers[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/**
 * Builds the session's eBay config from request headers.
 * @param {import('express').Request} req - MCP initialize request.
 * @returns {import('../build/types/ebay.js').EbayConfig} eBay config for the session.
 * @throws {Error} When the app credentials are missing or the environment is invalid.
 */
export const resolveEbayConfigFromHeaders = (req) => {
  const clientId = header(req, ebayHeaders.clientId);
  const clientSecret = header(req, ebayHeaders.clientSecret);
  if (!(clientId && clientSecret)) {
    throw new Error(
      `Missing eBay credentials. Send the ${ebayHeaders.clientId} and ${ebayHeaders.clientSecret} headers (plus ${ebayHeaders.refreshToken} for seller tools).`,
    );
  }
  const environment = (header(req, ebayHeaders.environment) ?? 'production').toLowerCase();
  if (environment !== 'production' && environment !== 'sandbox') {
    throw new Error(`${ebayHeaders.environment} must be "production" or "sandbox".`);
  }
  return {
    clientId,
    clientSecret,
    refreshToken: header(req, ebayHeaders.refreshToken),
    environment,
    marketplaceId: header(req, ebayHeaders.marketplaceId) ?? 'EBAY_US',
    contentLanguage: header(req, ebayHeaders.contentLanguage) ?? 'en-US',
  };
};
