import { defineTool } from "../registry.js";

export const getAccount = defineTool({
  name: "get_account",
  description:
    "Get details about the current Bunny account: name, email, and account balance. Useful to confirm which account the agent is operating on.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const user = await client.main<Record<string, any>>("GET", "/user");
    return {
      id: user.Id,
      email: user.Email,
      name: [user.FirstName, user.LastName].filter(Boolean).join(" "),
      balance: user.Balance,
      billing_type: user.BillingType,
    };
  },
});

export const accountTools = [getAccount];
