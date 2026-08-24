import { cookies } from "next/headers";

import type { ActorContext } from "@shoppingpal/contracts";
import { getMedusaConfig } from "@/lib/commerce/config";
import { MedusaClient } from "@/lib/commerce/medusa-client";
import { MedusaCartProvider } from "@/lib/cart/medusa-cart-provider";

export const MEDUSA_CUSTOMER_COOKIE = "sp_customer";

interface MedusaCustomer {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface MedusaAuthResult {
  token: string;
  user: { id: string; name: string; email: string; image: string | null };
}

function medusaClient(): MedusaClient {
  const config = getMedusaConfig();
  if (!config) throw new Error("Medusa authentication is not configured.");
  return new MedusaClient(config);
}

function toSessionUser(customer: MedusaCustomer) {
  return {
    id: customer.id,
    email: customer.email,
    name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email,
    image: null,
  };
}

async function getMedusaUser(token: string) {
  const result = await medusaClient().get<{ customer: MedusaCustomer }>(
    "/store/customers/me",
    { authorization: `Bearer ${token}` },
  );
  return toSessionUser(result.customer);
}

/** Server-to-server Medusa emailpass bridge used by the existing auth forms. */
export async function medusaAuthAction(
  action: "sign-in/email" | "sign-up/email",
  input: { name?: string; email: string; password: string },
): Promise<MedusaAuthResult> {
  const client = medusaClient();
  let token: string;

  if (action === "sign-up/email") {
    const registered = await client.post<{ token: string }>(
      "/auth/customer/emailpass/register",
      { email: input.email, password: input.password },
    );
    const names = (input.name ?? input.email).trim().split(/\s+/);
    await client.post(
      "/store/customers",
      {
        email: input.email,
        first_name: names[0],
        ...(names.slice(1).join(" ") ? { last_name: names.slice(1).join(" ") } : {}),
      },
      { authorization: `Bearer ${registered.token}` },
    );
    const signedIn = await client.post<{ token: string }>(
      "/auth/customer/emailpass",
      { email: input.email, password: input.password },
    );
    token = signedIn.token;
  } else {
    const signedIn = await client.post<{ token: string }>(
      "/auth/customer/emailpass",
      { email: input.email, password: input.password },
    );
    token = signedIn.token;
  }

  const guestToken = (await cookies()).get("sp_guest")?.value;
  if (guestToken?.startsWith("cart_")) {
    await new MedusaCartProvider().attachCustomer(guestToken, token);
  }
  return { token, user: await getMedusaUser(token) };
}

async function getMedusaSessionUser() {
  const token = (await cookies()).get(MEDUSA_CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  try {
    return await getMedusaUser(token);
  } catch {
    return null;
  }
}

/** Current Medusa customer (or null). Safe to call in any server context. */
export async function getSessionUser(): Promise<{
  id: string;
  name: string;
  email: string;
  image: string | null;
} | null> {
  return getMedusaSessionUser();
}

/** Canonical server-derived identity shared by commerce and the agent boundary. */
export async function getActorContext(): Promise<ActorContext | null> {
  const user = await getSessionUser();
  if (user) {
    return {
      kind: "customer",
      actorId: user.id,
      customerId: user.id,
      principalId: user.id,
    };
  }
  const guest = (await cookies()).get("sp_guest")?.value;
  return guest
    ? { kind: "guest", actorId: `guest:${guest}`, principalId: `guest:${guest}` }
    : null;
}

export function googleOAuthConfigured(): boolean {
  return false;
}
