export type CartRef =
  | { kind: "guest"; token: string }
  | { kind: "user"; userId: string };
