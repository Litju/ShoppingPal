import { eveChannel } from "eve/channels/eve";
import { localDev, none, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  // Public portfolio chat is intentionally anonymous; same-origin routes and
  // the session-scoped actor fallback keep anonymous conversations isolated.
  auth: [vercelOidc(), localDev(), none()],
});
