/**
 * Bunny Agent embed loader.
 *
 * Drop into any page (e.g. the Bunny Dashboard):
 *   <script src="https://<agent-host>/embed.js" async></script>
 *
 * Renders a floating launcher button that toggles the agent chat in an
 * iframe. Override the agent origin with data-agent-origin on the script tag.
 */
(function () {
  var script = document.currentScript;
  var origin =
    (script && script.getAttribute("data-agent-origin")) ||
    (script ? new URL(script.src).origin : "");

  var PANEL_ID = "bunny-agent-panel";
  var BUTTON_ID = "bunny-agent-button";
  var OPEN_CLASS = "bunny-agent-open";
  if (document.getElementById(BUTTON_ID)) return;

  var style = document.createElement("style");
  style.textContent =
    "#" + BUTTON_ID + "{position:fixed;bottom:24px;right:24px;width:56px;height:56px;" +
    "border-radius:50%;border:none;padding:0;cursor:pointer;z-index:2147483000;" +
    "background:linear-gradient(85.19deg,#ff2a64 -133.27%,#ffaf48 105.93%);" +
    "box-shadow:0 4px 16px rgba(0,0,0,.25);" +
    "transition:transform .2s cubic-bezier(.33,0,.2,1),box-shadow .2s ease;}" +
    "#" + BUTTON_ID + ":hover{transform:scale(1.06);box-shadow:0 6px 24px rgba(0,0,0,.3);}" +
    "#" + BUTTON_ID + ":active{transform:scale(.85);}" +
    "#" + BUTTON_ID + " .bunny-agent-icon{position:absolute;inset:0;display:flex;" +
    "align-items:center;justify-content:center;" +
    "transition:transform .24s cubic-bezier(.33,0,.2,1),opacity .16s ease;}" +
    "#" + BUTTON_ID + " svg{width:26px;height:26px;display:block;}" +
    "#" + BUTTON_ID + " .bunny-agent-icon--close{opacity:0;transform:rotate(-60deg) scale(.6);}" +
    "#" + BUTTON_ID + "." + OPEN_CLASS + " .bunny-agent-icon--chat{opacity:0;transform:rotate(60deg) scale(.6);}" +
    "#" + BUTTON_ID + "." + OPEN_CLASS + " .bunny-agent-icon--close{opacity:1;transform:none;}" +
    "#" + PANEL_ID + "{position:fixed;bottom:92px;right:24px;width:400px;height:600px;" +
    "max-height:calc(100vh - 120px);max-width:calc(100vw - 48px);border:none;border-radius:16px;" +
    "box-shadow:0 12px 40px rgba(0,0,0,.25);z-index:2147483000;background:#fff;" +
    "opacity:0;visibility:hidden;pointer-events:none;transform-origin:bottom right;" +
    "transform:translateY(12px) scale(.98);" +
    "transition:opacity .2s ease,transform .2s cubic-bezier(.33,0,.2,1),visibility 0s .2s;}" +
    "#" + PANEL_ID + "." + OPEN_CLASS + "{opacity:1;visibility:visible;pointer-events:auto;transform:none;" +
    "transition:opacity .25s ease,transform .25s cubic-bezier(.33,0,.2,1);}" +
    "@media (prefers-reduced-motion:reduce){" +
    "#" + BUTTON_ID + ",#" + BUTTON_ID + " .bunny-agent-icon,#" + PANEL_ID + "{transition:none;}}";
  document.head.appendChild(style);

  var button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.setAttribute("aria-label", "Open Bunny Agent");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML =
    '<span class="bunny-agent-icon bunny-agent-icon--chat" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 3C6.75 3 2.5 6.62 2.5 11.08c0 2.53 1.37 4.79 3.52 6.27-.08 1.11-.46 2.34-1.34 3.37-.19.22-.03.56.26.53 2.06-.18 3.63-1 4.7-1.83.75.16 1.54.25 2.36.25 5.25 0 9.5-3.62 9.5-8.08S17.25 3 12 3z"/>' +
    "</svg></span>" +
    '<span class="bunny-agent-icon bunny-agent-icon--close" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5.5 9.5 12 16l6.5-6.5"/>' +
    "</svg></span>";
  document.body.appendChild(button);

  var iframe = null;
  var open = false;
  button.addEventListener("click", function () {
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PANEL_ID;
      iframe.src = origin + "/widget";
      iframe.allow = "clipboard-write";
      document.body.appendChild(iframe);
      // Flush layout so the first open transitions instead of snapping.
      iframe.getBoundingClientRect();
    }
    open = !open;
    button.classList.toggle(OPEN_CLASS, open);
    iframe.classList.toggle(OPEN_CLASS, open);
    button.setAttribute("aria-label", open ? "Close Bunny Agent" : "Open Bunny Agent");
    button.setAttribute("aria-expanded", String(open));
  });
})();
