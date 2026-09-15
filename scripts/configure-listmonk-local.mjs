import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const apiUser = process.env.LISTMONK_API_USER || "commune-api";
const apiToken = process.env.LISTMONK_API_TOKEN;
const demoUser = process.env.LISTMONK_DEMO_USER || "demo";
const demoPassword = process.env.LISTMONK_DEMO_PASSWORD || "Demo123!";
const publicUrl = process.env.LISTMONK_PUBLIC_URL?.replace(/\/$/, "");
if (!apiToken) throw new Error("LISTMONK_API_TOKEN is required in .env.local.");
if (!/^[a-zA-Z0-9_-]+$/.test(apiUser)) throw new Error("LISTMONK_API_USER contains unsupported characters.");
if (!/^[a-zA-Z0-9_-]+$/.test(demoUser)) throw new Error("LISTMONK_DEMO_USER contains unsupported characters.");
if (demoPassword.length < 8) throw new Error("LISTMONK_DEMO_PASSWORD must contain at least 8 characters.");
let parsedPublicUrl;
try { parsedPublicUrl = new URL(publicUrl); } catch { throw new Error("LISTMONK_PUBLIC_URL must be a valid public origin."); }
if (!(["http:", "https:"].includes(parsedPublicUrl.protocol)) || parsedPublicUrl.origin !== publicUrl) throw new Error("LISTMONK_PUBLIC_URL must be a valid public origin.");

const tokenHash = createHash("sha256").update(apiToken).digest("hex");
const smtp = JSON.stringify([{
  host: "supabase_inbucket_circular",
  port: 1025,
  enabled: true,
  password: "",
  tls_type: "NONE",
  username: "",
  max_conns: 2,
  idle_timeout: "15s",
  wait_timeout: "5s",
  auth_protocol: "none",
  email_headers: [],
  from_addresses: [],
  hello_hostname: "commune.local",
  max_msg_retries: 2,
  msg_retry_delay: "500ms",
  tls_skip_verify: false,
}]);

const demoLoginScript = JSON.stringify(`(() => {
  const mountDemoLogin = () => {
    if (window.location.pathname !== "/admin/login") return;

    const form = document.querySelector('form[action="/admin/login"]');
    const username = form?.querySelector('input[name="username"]');
    const password = form?.querySelector('input[name="password"]');
    const submitRow = form?.querySelector("p.submit");

    if (!form || !username || !password || !submitRow || document.querySelector("[data-commune-demo-login]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Use demo account";
    button.setAttribute("data-commune-demo-login", "true");
    button.className = "button";
    button.style.marginLeft = "0.75rem";
    button.style.background = "#eef5f3";
    button.style.color = "#174c3c";
    button.style.borderColor = "#174c3c";
    button.addEventListener("click", () => {
      username.value = ${JSON.stringify(demoUser)};
      password.value = ${JSON.stringify(demoPassword)};
      username.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("input", { bubbles: true }));
      password.focus();
    });

    submitRow.appendChild(button);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountDemoLogin, { once: true });
  } else {
    mountDemoLogin();
  }
})();`);

const sql = `
create extension if not exists pgcrypto;
update users
set username = 'commune-api', email = 'commune-api@localhost', name = 'Commune integration', updated_at = now()
where username = 'circular-api' and not exists (select 1 from users where username = 'commune-api');
update users
set username = 'commune', password = crypt('CommuneListmonkLocal123!', gen_salt('bf', 12)), email = 'commune@listmonk', name = 'Commune', updated_at = now()
where username = 'circular' and type = 'user' and not exists (select 1 from users where username = 'commune');
insert into users (username, password_login, password, email, name, type, user_role_id, status)
values ('${apiUser}', false, '${tokenHash}', '${apiUser}@localhost', 'Commune integration', 'api', 1, 'enabled')
on conflict (username) do update set password=excluded.password, password_login=false, type='api', user_role_id=1, status='enabled', updated_at=now();
insert into users (username, password_login, password, email, name, type, user_role_id, list_role_id, status)
values ('${demoUser}', true, crypt('${demoPassword.replaceAll("'", "''")}', gen_salt('bf', 12)), 'demo@commune.local', 'Commune Demo Administrator', 'user', 1, null, 'enabled')
on conflict (username) do update set password=excluded.password, password_login=true, email=excluded.email, name=excluded.name, type='user', user_role_id=1, list_role_id=null, status='enabled', updated_at=now();
update settings set value = $json$${smtp}$json$::jsonb where key = 'smtp';
update settings set value = '"APSS"'::jsonb where key = 'app.site_name';
update settings set value = '"APSS <community@apss.test>"'::jsonb where key = 'app.from_email';
update settings set value = $url$${JSON.stringify(publicUrl)}$url$::jsonb where key = 'app.root_url';
update settings set value = $script$${demoLoginScript}$script$::jsonb where key = 'appearance.admin.custom_js';
update settings set value = $script$${demoLoginScript}$script$::jsonb where key = 'appearance.public.custom_js';
`;

execFileSync("docker", ["exec", "circular_listmonk_db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "listmonk", "-d", "listmonk", "-c", sql], { stdio: "inherit" });
execFileSync("docker", ["restart", "circular_listmonk"], { stdio: "ignore" });
console.log(`Local listmonk is configured. Demo administrator: ${demoUser}`);
