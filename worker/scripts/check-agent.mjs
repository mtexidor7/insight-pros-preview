// READ-ONLY check of the agent the website orb talks to. Places no calls and changes nothing.
// Run locally (never in the browser):  RETELL_API_KEY=key_... node worker/scripts/check-agent.mjs
// Prints the agent's name, which versions exist, which one is published, and what the orb will use.
const AGENT_ID = process.env.RETELL_AGENT_ID || "agent_a39dab05dd12699bb82b353df2";
const key = process.env.RETELL_API_KEY;
if (!key) { console.error("RETELL_API_KEY is not set"); process.exit(1); }

const get = async (path) => {
  const res = await fetch("https://api.retellai.com" + path, { headers: { Authorization: `Bearer ${key}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
};
const summary = (a) => ({
  version: a.version,
  published: a.is_published,
  title: a.version_title || a.version_description || "",
  name: a.agent_name,
  engine: a.response_engine?.type,
  engine_id: a.response_engine?.llm_id || a.response_engine?.conversation_flow_id || "",
  engine_version: a.response_engine?.version,
  voice: a.voice_id,
  modified: a.last_modification_timestamp ? new Date(a.last_modification_timestamp).toISOString() : "",
});

const latest = await get(`/get-agent/${AGENT_ID}`);
console.log("Agent:", latest.agent_name, `(${AGENT_ID})`);
let versions = [];
try { versions = await get(`/get-agent-versions/${AGENT_ID}`); } catch (e) { console.warn("Could not list versions:", e.message); }
if (versions.length) console.table(versions.map(summary));
else console.table([summary(latest)]);

const published = versions.filter((v) => v.is_published).sort((a, b) => b.version - a.version)[0];
const newest = versions.sort((a, b) => b.version - a.version)[0] || latest;
console.log("\nOrb setting: agentVersion = \"latest_published\" (js/config.js)");
console.log(published ? `-> web calls will use published version ${published.version}.` : "-> WARNING: no published version found. Publish one in Retell, or pin a version number in js/config.js.");
if (published && newest.version !== published.version) console.log(`Note: version ${newest.version} is newer but unpublished (draft); the orb will NOT use it.`);
