# eBay Seller MCP Server (hosted)

**Run your eBay store from any AI agent.** This Actor hosts a production-ready [Model Context Protocol](https://modelcontextprotocol.io) server with about **300 eBay Sell API tools**. Point Claude, Cursor, ChatGPT, n8n or any other MCP client at it, and your agent can:

- **Manage listings:** create and update inventory items and offers, publish, revise prices and quantities, end listings.
- **Handle orders:** list orders, add shipping and tracking, issue refunds, and manage returns and cancellations.
- **Run marketing:** Promoted Listings campaigns, ad groups, keywords, discounts and coupons.
- **Read analytics:** traffic reports, seller standards and listing recommendations.
- **Talk to buyers:** read and send messages, manage offers to buyers, and leave feedback.
- **Configure the account:** business policies, programs and taxonomy (categories and item aspects).

There's nothing to install or host yourself. You pay per tool call.

## Connect

The server runs in Apify **Standby** mode:

```
https://<actor-owner>--ebay-seller-mcp.apify.actor/mcp
```

Every request needs:

| Header | Value |
|---|---|
| `Authorization` | `Bearer <your Apify API token>` |
| `x-ebay-client-id` | Your eBay app's Client ID (App ID) |
| `x-ebay-client-secret` | Your eBay app's Client Secret (Cert ID) |
| `x-ebay-refresh-token` | Your eBay user refresh token. Required for seller tools (inventory, orders, marketing…) |
| `x-ebay-environment` | `production` (default) or `sandbox` |
| `x-ebay-marketplace-id` | Optional, default `EBAY_US` |

**Claude Code:**

```bash
claude mcp add --transport http ebay https://<actor-owner>--ebay-seller-mcp.apify.actor/mcp \
  --header "Authorization: Bearer $APIFY_TOKEN" \
  --header "x-ebay-client-id: $EBAY_CLIENT_ID" \
  --header "x-ebay-client-secret: $EBAY_CLIENT_SECRET" \
  --header "x-ebay-refresh-token: $EBAY_REFRESH_TOKEN"
```

**Cursor and other clients:** in `mcp.json`:

```json
{
  "mcpServers": {
    "ebay": {
      "url": "https://<actor-owner>--ebay-seller-mcp.apify.actor/mcp",
      "headers": {
        "Authorization": "Bearer <APIFY_TOKEN>",
        "x-ebay-client-id": "<EBAY_CLIENT_ID>",
        "x-ebay-client-secret": "<EBAY_CLIENT_SECRET>",
        "x-ebay-refresh-token": "<EBAY_REFRESH_TOKEN>"
      }
    }
  }
}
```

### Getting eBay credentials (one-time, about 10 minutes)

1. Create a free developer account at [developer.ebay.com](https://developer.ebay.com), then create a **Production** keyset. This gives you the Client ID and Client Secret.
2. Generate a user refresh token for your seller account. The open-source setup wizard does this for you:

```bash
npx ebay-mcp setup
```

You can also use the "User Tokens" page in the eBay developer portal.

## Security

- Credentials are sent per session and kept **in memory only**. They're never written to disk or shared between users.
- The Actor never falls back to its owner's credentials. A session without your own keys is rejected.
- Idle sessions are closed after 30 minutes.
- Write tools act on your real eBay account. Test with `x-ebay-environment: sandbox` first.

## Pricing

Pay per event:

| Event | Price |
|---|---|
| Read tool call (get, list, search) | **$0.01** |
| Write tool call (create, update, delete, publish, ship…) | **$0.03** |

Failed tool calls are **not charged**. As an example, an agent that reviews 50 orders and adds tracking to 20 of them costs $0.50 + $0.60 = **$1.10**.

## FAQ

**Is this affiliated with eBay?** No. It uses eBay's official Sell APIs with your own credentials, under the eBay API License Agreement, and you're responsible for how your account is used.

**Which marketplaces are supported?** Every marketplace the Sell APIs support. Set `x-ebay-marketplace-id`, for example `EBAY_GB` or `EBAY_DE`.

**Open source?** Yes. It's based on the MIT-licensed [ebay-mcp](https://github.com/YosefHayim/ebay-mcp) by Yosef Hayim Sabag.
