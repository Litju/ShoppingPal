export interface ActorContext {
  kind: "guest" | "customer" | "agent";
  actorId: string;
  customerId?: string;
  principalId?: string;
}
